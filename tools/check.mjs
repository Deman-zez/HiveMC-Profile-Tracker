// Pre-publish checks for the tracker. Run locally with: node tools/check.mjs
// Exits with code 1 if anything is broken, so CI refuses to publish a broken site.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const problems = [];
const fail = msg => problems.push(msg);

// 1. every script parses
const scripts = readdirSync("js").filter(f => f.endsWith(".js")).map(f => "js/" + f);
for (const f of [...scripts, ...readdirSync("worker").filter(f => f.endsWith(".js")).map(f => "worker/" + f)]) {
  if (!existsSync(f)) continue;
  try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
  catch (e) { fail(`${f}: syntax error\n${String(e.stderr || e.message).trim()}`); }
}

// 2. CSS braces balance (an extra "}" silently drops the next rule)
const css = readFileSync("css/style.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/"(?:\\.|[^"\\])*"/g, '""');
let depth = 0, line = 1;
for (const ch of css) {
  if (ch === "\n") line++;
  if (ch === "{") depth++;
  if (ch === "}" && --depth < 0) { fail(`css/style.css: unexpected "}" near line ${line}`); depth = 0; }
}
if (depth > 0) fail(`css/style.css: ${depth} unclosed "{"`);

// 3. index.html references files that exist, all with one version tag
const html = readFileSync("index.html", "utf8");
const refs = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"?]+)(?:\?v=([^"]+))?"/g)];
const versions = new Set();
for (const [, path, v] of refs) {
  if (!existsSync(path)) fail(`index.html: missing file ${path}`);
  if (v) versions.add(v);
}
if (versions.size > 1) fail(`index.html: mixed version tags ${[...versions].join(", ")} (browsers may mix old and new files)`);

// 4. every js file is actually loaded by the page
for (const f of scripts) if (!refs.some(([, p]) => p === f)) fail(`${f} is not included in index.html`);

if (problems.length) {
  console.error("Checks failed:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log(`All checks passed: ${scripts.length} scripts, CSS balanced, ${refs.length} references, version ${[...versions][0] || "-"}`);
