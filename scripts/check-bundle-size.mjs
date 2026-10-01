// Fails when the client JavaScript from `next build` grows past a budget, so a heavy new dependency
// (or an accidental barrel import) shows up in the pull request instead of in production.
// Run after `npm run build`:  npm run check:bundle
//
// Size is the sum of gzip-compressed .js files under .next/static/chunks, which is a close proxy for
// what the browser downloads on first load. Override the limit with BUNDLE_BUDGET_KB.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB ?? 500);
const root = path.join(".next", "static", "chunks");

if (!fs.existsSync(root)) {
  console.error(`No build output at ${root}. Run "npm run build" first.`);
  process.exit(2);
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith(".js")) yield full;
  }
}

const files = [...walk(root)].map((file) => {
  const raw = fs.readFileSync(file);
  return { file: path.relative(root, file), raw: raw.length, gzip: zlib.gzipSync(raw, { level: 9 }).length };
});

const totalGzip = files.reduce((sum, f) => sum + f.gzip, 0);
const totalRaw = files.reduce((sum, f) => sum + f.raw, 0);
const kb = (bytes) => (bytes / 1024).toFixed(1);

console.log(`Client JS: ${kb(totalGzip)} KB gzip (${kb(totalRaw)} KB raw) across ${files.length} files`);
console.log("Largest chunks (gzip):");
for (const f of files.sort((a, b) => b.gzip - a.gzip).slice(0, 5)) {
  console.log(`  ${kb(f.gzip).padStart(7)} KB  ${f.file}`);
}

if (totalGzip / 1024 > BUDGET_KB) {
  console.error(`\nOver budget: ${kb(totalGzip)} KB > ${BUDGET_KB} KB. Find what grew (npx next experimental-analyze) or raise BUNDLE_BUDGET_KB deliberately.`);
  process.exit(1);
}
console.log(`\nWithin budget (${BUDGET_KB} KB).`);
