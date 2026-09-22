#!/usr/bin/env node
/**
 * Bundle report for the production build (run after `pnpm build:prod`).
 *
 *   node scripts/refactor/bundle-report.mjs
 *   node scripts/refactor/bundle-report.mjs --must-not-contain "mockPartnerHandlers" [--must-not-contain "..."]
 *   node scripts/refactor/bundle-report.mjs --initial-must-not-contain "jspdf"
 *   node scripts/refactor/bundle-report.mjs --record        USER ONLY: store as baseline
 *
 * "Initial" = JS/CSS referenced by the browser index.html (scripts, modulepreloads, stylesheets).
 * "Lazy"    = every other JS chunk.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const BROWSER = 'dist/miles-masterclass-v3/browser';
const BASELINE = 'docs/refactor/baseline/bundle.json';
const CACHE = 'docs/refactor/.cache';
const record = args.includes('--record');
const collect = (flag) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]] : []));
const mustNotAnywhere = collect('--must-not-contain');
const mustNotInitial = collect('--initial-must-not-contain');

if (!existsSync(BROWSER)) {
  console.error(`No production build at ${BROWSER}. Run "pnpm build:prod" first.`);
  process.exit(1);
}

const indexFile = ['index.csr.html', 'index.html'].map((f) => join(BROWSER, f)).find((f) => existsSync(f));
if (!indexFile) {
  console.error(`No index.html / index.csr.html in ${BROWSER}.`);
  process.exit(1);
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const html = readFileSync(indexFile, 'utf8');
const initialRefs = new Set();
for (const m of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+?\.(?:js|css))"/g)) {
  if (!/^https?:/.test(m[1])) initialRefs.add(m[1].replace(/^\.?\//, ''));
}

const files = walk(BROWSER)
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => {
    const buf = readFileSync(f);
    return { file: relative(BROWSER, f).split('\\').join('/'), raw: buf.length, gzip: gzipSync(buf).length, buf };
  });

const initial = files.filter((f) => initialRefs.has(f.file));
const lazy = files.filter((f) => !initialRefs.has(f.file) && f.file.endsWith('.js'));
const kb = (n) => Math.round((n / 1024) * 10) / 10;
const sum = (list, key) => list.reduce((acc, f) => acc + f[key], 0);

const report = {
  at: new Date().toISOString(),
  initial: { files: initial.length, rawKB: kb(sum(initial, 'raw')), gzipKB: kb(sum(initial, 'gzip')) },
  lazy: { files: lazy.length, rawKB: kb(sum(lazy, 'raw')), gzipKB: kb(sum(lazy, 'gzip')) },
  largestLazy: [...lazy]
    .sort((a, b) => b.raw - a.raw)
    .slice(0, 10)
    .map((f) => ({ file: f.file, rawKB: kb(f.raw), gzipKB: kb(f.gzip) })),
};

mkdirSync(CACHE, { recursive: true });
writeFileSync(join(CACHE, 'bundle.json'), JSON.stringify(report, null, 2));

console.log(`Initial: ${report.initial.files} files, ${report.initial.rawKB} KB raw / ${report.initial.gzipKB} KB gzip`);
console.log(`Lazy:    ${report.lazy.files} chunks, ${report.lazy.rawKB} KB raw / ${report.lazy.gzipKB} KB gzip`);
console.log('Largest lazy chunks:');
for (const c of report.largestLazy) console.log(`  ${c.file}  ${c.rawKB} KB (${c.gzipKB} KB gz)`);

let ok = true;

if (existsSync(BASELINE) && !record) {
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const delta = report.initial.gzipKB - base.initial.gzipKB;
  const pct = base.initial.gzipKB ? (delta / base.initial.gzipKB) * 100 : 0;
  console.log(
    `Initial gzip vs baseline: ${delta >= 0 ? '+' : ''}${kb(delta * 1024)} KB (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`,
  );
  if (pct > 3) console.log('WARNING: initial bundle grew more than 3% vs baseline. Explain this in the phase report.');
}

const scan = (list, needles, label) => {
  for (const needle of needles) {
    const hits = list.filter((f) => f.buf.includes(needle)).map((f) => f.file);
    if (hits.length) {
      ok = false;
      console.log(`FAIL: "${needle}" found in ${label}: ${hits.join(', ')}`);
    } else {
      console.log(`OK: "${needle}" not present in ${label}`);
    }
  }
};
scan(files, mustNotAnywhere, 'the browser build');
scan(initial, mustNotInitial, 'the initial bundle');

if (record) {
  mkdirSync('docs/refactor/baseline', { recursive: true });
  writeFileSync(BASELINE, JSON.stringify(report, null, 2));
  console.log(`Baseline recorded → ${BASELINE}`);
}

process.exit(ok ? 0 : 1);
