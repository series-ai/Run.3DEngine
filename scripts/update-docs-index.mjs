import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";
import { LEGACY_LABELS } from "./docs-config.mjs";

export function updateDocsIndex(cwd = resolve(import.meta.dirname, "..")) {
  const indexPath = resolve(cwd, "docs-index.txt");
  if (!existsSync(indexPath)) {
    console.warn("docs-index.txt not found, skipping update");
    return;
  }

  const fresh = readFileSync(indexPath, "utf-8").trimEnd();

  // Extract the label from the index line, e.g. [Run.3DEngine Docs Index]|...
  const labelMatch = fresh.match(/^\[([^\]]+)\]/);
  if (!labelMatch) {
    console.warn("Could not parse label from docs-index.txt, skipping");
    return;
  }

  // Build regexes for the current label and all legacy labels
  const allLabels = [labelMatch[1], ...LEGACY_LABELS];
  const regexes = allLabels.map((label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\[${escaped}\\][^\\n]*(?:\\n(?![\\[<])[^\\n]*)*`);
  });

  const targets = ["AGENTS.md", "CLAUDE.md"];

  for (const file of targets) {
    const filePath = resolve(cwd, file);

    if (!existsSync(filePath)) {
      // Create the file with just the index line
      writeFileSync(filePath, fresh + "\n");
      console.log(`Created ${file}`);
      continue;
    }

    let content = readFileSync(filePath, "utf-8");

    const matchedRe = regexes.find((re) => re.test(content));
    if (matchedRe) {
      content = content.replace(matchedRe, fresh);
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
