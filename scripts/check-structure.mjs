#!/usr/bin/env node
/**
 * Structure ratchet — see docs/STRUCTURE.md.
 *
 * Counts the things ESLint cannot see (folder shape, file naming, cross-layer
 * imports) plus a few it could, and compares them against docs/baselines.json.
 *
 * A count may fall, never rise. Fixing a batch is the point:
 *   node scripts/check-structure.mjs --update
 * then commit the baselines diff alongside the fix.
 *
 * Deliberately dependency-free and regex-based rather than AST-based: it runs
 * on every commit, and a grep that is 95% right and instant beats a parser that
 * is 100% right and slow. Where a regex would be wrong more often than that,
 * the metric is left to ESLint instead.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BASELINES = join(ROOT, 'docs', 'baselines.json');

/** Every file under src/, once — the counters below all read from this. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC).map((path) => ({
  path,
  rel: relative(ROOT, path),
  ext: extname(path),
  get text() {
    const cached = (this._t ??= readFileSync(this.path, 'utf8'));
    return cached;
  },
}));

const ts = files.filter((f) => f.ext === '.ts');
const html = files.filter((f) => f.ext === '.html');
const prod = ts.filter((f) => !f.rel.endsWith('.spec.ts') && !f.rel.endsWith('.stories.ts'));

/** Occurrences of a global regex across a file set. */
const count = (set, re) =>
  set.reduce((n, f) => n + (f.text.match(new RegExp(re.source, re.flags + 'g'))?.length ?? 0), 0);

/** Files matching a predicate. */
const filesWhere = (set, fn) => set.filter((f) => fn(f.text, f.rel)).map((f) => f.rel);

// `<img …>` may span lines, so match the whole tag before testing for alt.
const imgWithoutAlt = html.reduce(
  (n, f) => n + (f.text.match(/<img\b[^>]*>/gs) ?? []).filter((tag) => !tag.includes('alt=')).length,
  0,
);

const metrics = {
  stubFacades: count(prod, /:\s*any\s*=\s*(\{|null)/),
  explicitAny: count(prod, /:\s*any\b/),
  nullAsAny: count(prod, /null\s+as\s+any/),
  sharedImportsFeatures: count(
    ts.filter((f) => f.rel.startsWith('src/app/shared/')),
    /from\s+'[^']*features\//,
  ),
  imgWithoutAlt,
  standaloneTrue: count(prod, /standalone:\s*true/),
  ngOnDestroy: count(prod, /ngOnDestroy/),
  hostDecorators: count(prod, /@Host(Binding|Listener)/),
  documentFromCommon: ts.filter((f) => /import\s*\{[^}]*\bDOCUMENT\b[^}]*\}\s*from\s*'@angular\/common'/.test(f.text)).length,
  ngClassOrStyle: count(html, /\[?ngClass\]?|\[?ngStyle\]?/),
  componentSuffixedClasses: count(prod, /export class \w+Component\b/),
  dialogsOutsideSharedDialog: new Set(
    files
      .filter((f) => /[\\/][\w-]+-dialog[\\/]/.test(f.rel) && !f.rel.includes('shared/components/dialog/'))
      .map((f) => f.rel.replace(/[^\\/]+$/, '')),
  ).size,
  modelsOutsideCoreModels: files.filter(
    (f) => f.rel.endsWith('.model.ts') && !f.rel.includes('shared/core/models'),
  ).length,
};

// `failingTests` is owned by the test run, not by this script — carry it through
// untouched so `--update` never silently lowers a number it did not measure.
const baselines = JSON.parse(readFileSync(BASELINES, 'utf8'));

if (process.argv.includes('--update')) {
  writeFileSync(BASELINES, JSON.stringify({ ...baselines, ...metrics }, null, 2) + '\n');
  console.log('baselines updated:');
  for (const [k, v] of Object.entries(metrics)) {
    const was = baselines[k];
    if (was !== v) console.log(`  ${k}: ${was} → ${v}`);
  }
  process.exit(0);
}

let failed = false;
let improved = 0;
for (const [key, now] of Object.entries(metrics)) {
  const max = baselines[key];
  if (max === undefined) {
    console.error(`✗ ${key}: no baseline recorded (add it to docs/baselines.json)`);
    failed = true;
  } else if (now > max) {
    console.error(`✗ ${key}: ${now} (baseline ${max}) — this must not grow. See docs/STRUCTURE.md`);
    failed = true;
  } else if (now < max) {
    improved++;
    console.log(`✓ ${key}: ${now} (was ${max}) — run with --update to lock it in`);
  }
}

if (failed) {
  console.error('\nStructure check failed. Fix the regression, or justify it in docs/STRUCTURE.md §7.');
  process.exit(1);
}
console.log(improved ? `\nStructure check passed, ${improved} metric(s) improved.` : 'Structure check passed.');
