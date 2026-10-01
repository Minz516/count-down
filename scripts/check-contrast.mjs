// WCAG 2.x contrast check for the theme tokens in app/globals.css (dark base block and light block).
// Run with `npm run check:contrast`. Exits 1 if any text pair is under 4.5:1, any UI boundary under 3:1,
// or the two light blocks (media query and data-theme attribute) have drifted apart.
import fs from "node:fs";
const css = fs.readFileSync("app/globals.css", "utf8");

function block(startRe) {
  const m = css.match(startRe);
  if (!m) throw new Error("block not found " + startRe);
  let i = css.indexOf("{", m.index) + 1;
  let depth = 1;
  let j = i;
  while (depth > 0) {
    const c = css[j++];
    if (c === "{") depth++;
    else if (c === "}") depth--;
  }
  return css.slice(i, j - 1);
}
function tokens(text) {
  const out = {};
  for (const m of text.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}
const dark = tokens(block(/^:root \{/m));
const lightAttr = tokens(block(/:root\[data-theme="light"\]/));
const lightMedia = tokens(block(/:root:not\(\[data-theme="dark"\]\)/));
const light = { ...dark, ...lightAttr };

const lin = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const mix = (fg, bg, a) => {
  const f = parseInt(fg.slice(1), 16);
  const b = parseInt(bg.slice(1), 16);
  const ch = (s) => Math.round(((f >> s) & 255) * a + ((b >> s) & 255) * (1 - a));
  return "#" + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("");
};

// [foreground token, background token, minimum ratio, what it is]
const TEXT = 4.5;
const UI = 3;
const pairs = [
  ["on-surface", "surface-deep", TEXT, "body text on page"],
  ["on-surface", "surface-container", TEXT, "body text on card"],
  ["on-surface", "surface-elevated", TEXT, "text on menu / hover"],
  ["on-surface-variant", "surface-container", TEXT, "secondary text on card"],
  ["text-muted", "surface-deep", TEXT, "muted text on page"],
  ["text-muted", "surface-container", TEXT, "muted text on card"],
  ["text-muted", "surface-container-lowest", TEXT, "placeholder / muted in inputs"],
  ["text-muted", "surface-elevated", TEXT, "muted text on menu"],
  ["primary", "surface-deep", TEXT, "accent text on page (active tab, links)"],
  ["primary", "surface-container", TEXT, "accent text on card (countdown digits)"],
  ["primary", "surface-elevated", TEXT, "accent text on menu"],
  ["on-primary-container", "primary-container", TEXT, "primary button label"],
  ["on-primary", "primary", TEXT, "text on accent fill"],
  ["error", "surface-container", TEXT, "error text on card"],
  ["error", "surface-deep", TEXT, "error text on page"],
  ["accent-warning", "surface-container", TEXT, "past-deadline warning on card"],
  ["status-past", "surface-container", TEXT, "status text: past"],
  ["status-today", "surface-container", TEXT, "status text: today"],
  ["status-soon", "surface-container", TEXT, "status text: soon"],
  ["field-border", "surface-container-lowest", UI, "input border vs input fill"],
  ["field-border", "surface-container", UI, "input border vs card"],
];
// chips: coloured text on a 12% tint of itself over the card
const chipPairs = [
  ["status-past", "chip past"],
  ["status-today", "chip today"],
  ["status-soon", "chip soon"],
];

let failures = 0;
function run(name, t) {
  console.log("\n== " + name);
  for (const [fg, bg, min, what] of pairs) {
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) failures++;
    console.log((ok ? "pass " : "FAIL ") + r.toFixed(2).padStart(5) + " (min " + min + ")  " + fg + " on " + bg + "  - " + what);
  }
  for (const [fg, what] of chipPairs) {
    const bg = mix(t[fg], t["surface-container"], 0.12);
    const r = ratio(t[fg], bg);
    const ok = r >= TEXT;
    if (!ok) failures++;
    console.log((ok ? "pass " : "FAIL ") + r.toFixed(2).padStart(5) + " (min 4.5)  " + fg + " on its 12% tint - " + what);
  }
}
run("dark", dark);
run("light", light);
// the two light blocks must stay identical
const keys = new Set([...Object.keys(lightAttr), ...Object.keys(lightMedia)]);
const drift = [...keys].filter((k) => lightAttr[k] !== lightMedia[k]);
console.log("\nlight blocks in sync:", drift.length === 0 ? "yes" : "NO, differing tokens: " + drift.join(", "));
console.log("\nfailures:", failures);
process.exit(failures ? 1 : 0);
