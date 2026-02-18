import { existsSync, mkdirSync, rmSync, readdirSync, copyFileSync, statSync, readFileSync, appendFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const docsSource = join(packageRoot, "docs");

if (!existsSync(docsSource)) {
  process.exit(0);
}

// Find the project root where docs and .gitignore should live.
// 1. INIT_CWD — set by npm/yarn/pnpm to where `npm install` was invoked (best for monorepos)
// 2. Walk up to find .git directory (reliable fallback)
// 3. Walk up to exit node_modules (legacy fallback)
// 4. Local dev — packageRoot itself
function findProjectRoot() {
  // INIT_CWD is the directory where the user ran `npm install`
  if (process.env.INIT_CWD && existsSync(process.env.INIT_CWD)) {
    return resolve(process.env.INIT_CWD);
  }

  // Walk up looking for .git (repo root)
  let dir = packageRoot;
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }

  // Legacy: walk up to exit node_modules
  dir = packageRoot;
  while (true) {
    const parent = dirname(dir);
    if (parent === dir) break;
    const baseName = dir.split(/[\\/]/).pop();
    if (baseName === "node_modules") return parent;
    dir = parent;
  }

  // Not inside node_modules — running locally in the package itself
  return packageRoot;
}

const projectRoot = findProjectRoot();
const docsDest = join(projectRoot, ".rundot", "3d-engine-docs");

// Remove existing docs to keep them in sync
if (existsSync(docsDest)) {
  rmSync(docsDest, { recursive: true, force: true });
}

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(docsSource, docsDest);

// Add .rundot/3d-engine-docs to .gitignore if it exists and the entry is missing
const gitignorePath = join(projectRoot, ".gitignore");
if (existsSync(gitignorePath)) {
  const gitignoreContent = readFileSync(gitignorePath, "utf-8");
  const entry = ".rundot/3d-engine-docs";
  const lines = gitignoreContent.split(/\r?\n/);
  if (!lines.some((line) => line.trim() === entry)) {
    const needsNewline = gitignoreContent.length > 0 && !gitignoreContent.endsWith("\n");
    appendFileSync(gitignorePath, (needsNewline ? "\n" : "") + entry + "\n");
  }
}

// Generate docs index from the copied docs and splice into the consumer's AGENTS.md/CLAUDE.md
const { genDocsIndex } = await import("./gen-docs-index.mjs");
const { updateDocsIndex } = await import("./update-docs-index.mjs");
const { DOCS_LABEL } = await import("./docs-config.mjs");

const indexPath = join(projectRoot, "docs-index.txt");
genDocsIndex(DOCS_LABEL, ".rundot/3d-engine-docs", docsDest, indexPath);
updateDocsIndex(projectRoot);
