#!/usr/bin/env node
// Typecheck gate for the MIRROR-OWNED layer (files this repo changes on top of the upstream
// snapshot). Nothing else in the pipeline covers them:
//   - `next build` runs with upstream's `typescript.ignoreBuildErrors: true`;
//   - `npm run typecheck:core` is a curated 27-file `files:` list that excludes them;
//   - the publish workflow's image build is a build, not a typecheck.
// A rebase can therefore resolve cleanly and still leave a call to a symbol upstream renamed
// (v3.8.52 → GLOBAL_TIMEOUT_MS in open-sse/handlers/search.ts was exactly that).
//
// Gate = "no NEW diagnostics in the mirror-owned files": pre-existing upstream noise is frozen
// in config/quality/custom-layer-types.json (same freeze-the-baseline pattern as
// config/quality/eslint-suppressions.json). Upstream scholarship may be added to that list, but
// only deliberately.
//
// Usage:
//   node scripts/check/custom-layer-types.mjs              # gate (CI + pre-push)
//   node scripts/check/custom-layer-types.mjs --print      # list current diagnostics
//   node scripts/check/custom-layer-types.mjs --sync-files # refresh files[] from baseline..HEAD
//   node scripts/check/custom-layer-types.mjs --seed       # rewrite suppressions from current
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const configPath = path.join(root, "config/quality/custom-layer-types.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");

const mode = process.argv[2] ?? "";

if (mode === "--sync-files") {
  const changed = execFileSync("git", ["diff", "--name-only", `${config.baseline}..HEAD`], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => /\.(ts|tsx)$/.test(f) && fs.existsSync(path.join(root, f)))
    .sort();
  config.files = changed;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`files[] refreshed from ${config.baseline}..HEAD -> ${changed.length} files`);
  process.exit(0);
}

const cfgFile = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
if (cfgFile.error) {
  console.error(ts.flattenDiagnosticMessageText(cfgFile.error.messageText, " "));
  process.exit(2);
}
const parsed = ts.parseJsonConfigFileContent(cfgFile.config, ts.sys, root);

// Root-naming the mirror files guarantees they are analysed even where the upstream tsconfig
// excludes them from its `include` globs (it excludes open-sse/ wholesale).
const watched = new Set(config.files.map((f) => path.join(root, f)));
const program = ts.createProgram([...new Set([...parsed.fileNames, ...watched])], {
  ...parsed.options,
  noEmit: true,
  incremental: false,
  composite: false,
  tsBuildInfoFile: undefined,
});

const counts = new Map();
for (const d of ts.getPreEmitDiagnostics(program)) {
  if (!d.file || !watched.has(d.file.fileName)) continue;
  const rel = path.relative(root, d.file.fileName).split(path.sep).join("/");
  const msg = ts.flattenDiagnosticMessageText(d.messageText, " ").replace(/\s+/g, " ");
  const key = `${rel} TS${d.code} ${msg}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

if (mode === "--print") {
  for (const [key, n] of [...counts].sort()) console.log(`${n}x ${key}`);
  console.log(`\n${counts.size} distinct diagnostic(s) across ${config.files.length} mirror files`);
  process.exit(0);
}

const seeded = mode === "--seed";
const budget = new Map(Object.entries(seeded ? {} : (config.suppressions ?? {})));
const violations = [];
for (const [key, n] of [...counts].sort()) {
  const allowed = budget.get(key) ?? 0;
  if (n > allowed) violations.push(`${n}x ${key}${allowed ? ` (${allowed} suppressed)` : ""}`);
  if (allowed) budget.set(key, allowed - Math.min(allowed, n));
}

// Stale entries are advisory only: they mean the file changed, not that the tree is broken.
const stale = [...budget].filter(([, left]) => left > 0).map(([key, left]) => `${left}x ${key}`);

if (seeded) {
  config.suppressions = Object.fromEntries([...counts].sort());
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`seeded ${config.suppressions && Object.keys(config.suppressions).length} entries`);
  process.exit(0);
}

if (stale.length) {
  console.log(`note: ${stale.length} suppression(s) no longer matched (prune with --seed):`);
  for (const s of stale) console.log(`  - ${s}`);
}

if (violations.length) {
  console.error(
    `\n✗ ${violations.length} NEW type diagnostic(s) in the mirror-owned layer:\n` +
      violations.map((v) => `  ${v}`).join("\n") +
      `\n\nA rebase most likely left a reference to a symbol upstream renamed.\n` +
      `Fix the code. Only freeze a diagnostic in config/quality/custom-layer-types.json if it is\n` +
      `genuinely pre-existing upstream noise, and say why in the commit message.\n`
  );
  process.exit(1);
}

console.log(
  `✓ no new type diagnostics in ${config.files.length} mirror-owned file(s) ` +
    `(${counts.size} frozen pre-existing)`
);
