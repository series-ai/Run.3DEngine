import { existsSync, mkdirSync, rmSync, readdirSync, copyFileSync, statSync, readFileSync, appendFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const docsSource = join(packageRoot, "docs");

if (!existsSync(docsSource)) {
  process.exit(0);
}

// Walk up from the package root to find the consuming project root.
// If we're inside node_modules, exit out of it. Otherwise (e.g. local dev), use packageRoot.
function findProjectRoot() {
  let dir = packageRoot;
  while (true) {
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    const baseName = dir.split(/[\\/]/).pop();
    if (baseName === "node_modules") {
      return parent;
    }
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
