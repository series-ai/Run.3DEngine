import { readdirSync, statSync, writeFileSync } from "fs";
import { join, relative, resolve, sep } from "path";
import { DOCS_LABEL } from "./docs-config.mjs";

export function genDocsIndex(
  label = DOCS_LABEL,
  root = "docs",
  srcDir = resolve(import.meta.dirname, "..", "docs"),
  outPath = resolve(import.meta.dirname, "..", "docs-index.txt"),
) {
  const src = resolve(srcDir);
  const dest = resolve(outPath);

  function walk(dir) {
    const entries = [];
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) entries.push(...walk(p));
      else if (e.endsWith(".md")) entries.push(relative(src, p).replaceAll(sep, "/"));
    }
    return entries.sort();
  }

  const files = walk(src);

  // Build compact tree: group by directory
  const tree = {};
  for (const f of files) {
    const i = f.lastIndexOf("/");
    const dir = i === -1 ? "." : f.slice(0, i);
    const name = f.slice(i + 1);
    (tree[dir] ??= []).push(name);
  }

  let out = `[${label}]|root:${root}`;
  for (const [dir, names] of Object.entries(tree)) {
    out += `|${dir}:{${names.join(",")}}`;
  }
  out += "\n";

  writeFileSync(dest, out);
  return files.length;
}

// CLI usage: node gen-docs-index.mjs [label] [root] [srcDir] [outPath]
if (process.argv[1]?.endsWith("gen-docs-index.mjs")) {
  const args = process.argv.slice(2);
  const count = genDocsIndex(args[0], args[1], args[2], args[3]);
  console.log(`Wrote ${count} files to docs-index.txt`);
}
