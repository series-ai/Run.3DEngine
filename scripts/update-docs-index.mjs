import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";

export function updateDocsIndex(cwd = resolve(import.meta.dirname, "..")) {
  const indexPath = resolve(cwd, "docs-index.txt");
  if (!existsSync(indexPath)) {
    console.warn("docs-index.txt not found, skipping update");
    return;
  }

  const fresh = readFileSync(indexPath, "utf-8").trimEnd();
  const label = "Docs Index";
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[${escaped}\\][^\\n]*(?:\\n(?![\\[<])[^\\n]*)*`);

  const targets = ["AGENTS.md", "CLAUDE.md"];

  for (const file of targets) {
    const filePath = resolve(cwd, file);
    if (!existsSync(filePath)) {
      console.log(`${file} not found, skipping`);
      continue;
    }

    let content = readFileSync(filePath, "utf-8");

    if (re.test(content)) {
      content = content.replace(re, fresh);
    } else {
      content = content.trimEnd() + "\n" + fresh + "\n";
    }

    writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }

  unlinkSync(indexPath);
  console.log("Deleted docs-index.txt");
}

// CLI usage
if (process.argv[1]?.endsWith("update-docs-index.mjs")) {
  updateDocsIndex();
}
