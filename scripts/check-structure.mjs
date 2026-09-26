#!/usr/bin/env node
/**
 * Structure & modernization check — the rules AGENTS.md §3/§4 set that ESLint can't express.
 *
 *   node scripts/check-structure.mjs           check; exit 1 on any violation
 *   node scripts/check-structure.mjs --prune   rewrite structure-baseline.json, removing entries that are
 *                                              fixed and lowering counts that dropped (it never adds or raises)
 *
 * Runs inside `pnpm lint` (so CI `verify` enforces it) and in `.husky/pre-commit`.
 *
 * It is a RATCHET. `structure-baseline.json` records the violations that existed when the check was
 * introduced (MIL-240), each with a reason. Anything not in the baseline fails. A baseline entry that no
 * longer matches reality fails too, with a message to run `--prune`, so the baseline can only shrink.
 * Adding a baseline entry is a deliberate, reviewed act: CODEOWNERS owns that file.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = 'src/app';
const BASELINE = 'structure-baseline.json';

/** Category folders AGENTS.md §3 names in the plural. A singular one is a naming slip. */
const SINGULAR_CATEGORIES = [
  'component',
  'page',
  'dialog',
  'service',
  'model',
  'util',
  'constant',
  'guard',
  'directive',
  'pipe',
  'interceptor',
];
const PLURAL_CATEGORIES = new Set(SINGULAR_CATEGORIES.map((c) => `${c}s`));

const stripHtmlComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');

/** Every file under `dir`, repo-relative, with `/` separators. */
export function walk(root, dir) {
  const out = [];
  for (const name of readdirSync(path.join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(path.join(root, rel)).isDirectory()) out.push(...walk(root, rel));
    else out.push(rel);
  }
  return out;
}

// ---------------------------------------------------------------- rules (pure: files in, findings out)

/** v20+ names: no `.component` / `.service` / … suffixes. */
export function suffixedFiles(files) {
  return files.filter((f) =>
    /\.(component|service|directive|pipe|guard|interceptor|module)(\.spec|\.stories)?\.(ts|html|css)$/.test(
      f,
    ),
  );
}

export function scssFiles(files) {
  return files.filter((f) => f.endsWith('.scss'));
}

/** A singular category folder (`component/`, `service/`…), unless it sits inside its plural (e.g. `services/dialog/`). */
export function singularFolders(files) {
  const dirs = new Set();
  for (const f of files) {
    const parts = f.split('/');
    for (let i = 1; i < parts.length - 1; i++) {
      if (SINGULAR_CATEGORIES.includes(parts[i]) && !PLURAL_CATEGORIES.has(parts[i - 1])) {
        dirs.add(parts.slice(0, i + 1).join('/'));
      }
    }
  }
  return [...dirs].sort();
}

/** No `shared/` layer inside a feature or admin area (AGENTS.md §3). */
export function nestedShared(files) {
  const dirs = new Set();
  for (const f of files) {
    const m = f.match(/^(src\/app\/(?:features|admin)\/.+?\/shared)\//);
    if (m) dirs.add(m[1]);
  }
  return [...dirs].sort();
}

/** No `-v2` names after a cutover. `partner-platform-v2` keeps its name until its cutover decision. */
export function v2Paths(files) {
  return files.filter((f) => /-v2\b/.test(f) && !f.includes('/admin/partner-platform-v2/'));
}

/**
 * Routed components live in `pages/` (AGENTS.md §3). Also allowed: layout shells, and a feature's own
 * root shell (`features/x/x.ts`, a `<router-outlet>` wrapper). Only `loadComponent` targets count —
 * `resolve` data imports and `loadChildren` route files don't.
 */
export function routedOutsidePages(routeFiles) {
  const found = [];
  for (const [file, src] of routeFiles) {
    for (const m of src.matchAll(/loadComponent:\s*\(\)\s*=>\s*import\(\s*'([^']+)'\s*\)/g)) {
      const target = m[1];
      const base = path.posix.basename(path.posix.dirname(file));
      const ok =
        target.includes('/pages/') ||
        target.includes('/layout/') ||
        target.startsWith('@layout/') ||
        target === `./${base}`;
      if (!ok) found.push(`${file} → ${target}`);
    }
  }
  return found.sort();
}

/** Component stylesheets. Each must carry a baseline reason (AGENTS.md §4.6 lists what justifies one). */
export function componentStylesheets(files) {
  return files.filter((f) => f.endsWith('.css') && f !== `${APP}/app.css`);
}

/** Static `style="…"` attributes per template (bound `[style.x]` is fine). */
export function inlineStyleCounts(htmlFiles) {
  const counts = {};
  for (const [file, html] of htmlFiles) {
    const n = (stripHtmlComments(html).match(/(?<![\w\].-])style="/g) ?? []).length;
    if (n) counts[file] = n;
  }
  return counts;
}

/** Every `@defer` block needs a sized `@placeholder` (AGENTS.md §4.4). Counted per template. */
export function deferWithoutPlaceholder(htmlFiles) {
  const found = [];
  for (const [file, html] of htmlFiles) {
    const clean = stripHtmlComments(html);
    const defers = (clean.match(/@defer\b/g) ?? []).length;
    const placeholders = (clean.match(/@placeholder\b/g) ?? []).length;
    if (defers > placeholders)
      found.push(`${file} (${defers} @defer, ${placeholders} @placeholder)`);
  }
  return found.sort();
}

/** `:root` colour tokens from styles.css, as lowercase 6-digit hex → token name. */
export function rootColorTokens(css) {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  const tokens = {};
  const hex2 = (n) => Number(n).toString(16).padStart(2, '0');
  for (const m of root.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    const [, name, raw] = m;
    const v = raw.trim().toLowerCase();
    let hex = null;
    if (/^#[0-9a-f]{6}$/.test(v)) hex = v;
    else if (/^#[0-9a-f]{3}$/.test(v)) hex = '#' + [...v.slice(1)].map((c) => c + c).join('');
    else {
      const rgb = v.match(/^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/);
      if (rgb) hex = '#' + rgb.slice(1, 4).map(hex2).join('');
    }
    if (hex && !tokens[hex]) tokens[hex] = name;
  }
  return tokens;
}

/** Arbitrary Tailwind colours (`bg-[#0e0e0e]`) that exactly equal a `:root` token, per file. */
export function tokenHexCounts(sourceFiles, tokens) {
  const counts = {};
  for (const [file, src] of sourceFiles) {
    let n = 0;
    for (const m of src.matchAll(/-\[#([0-9a-fA-F]{6})\]/g))
      if (tokens[`#${m[1].toLowerCase()}`]) n++;
    if (n) counts[file] = n;
  }
  return counts;
}

// ---------------------------------------------------------------- baseline comparison

/** A list rule: findings must be baseline keys; baseline keys must still be findings. */
export function compareList(label, findings, baselineMap = {}) {
  const errors = [];
  const stale = [];
  for (const f of findings) if (!(f in baselineMap)) errors.push(`${label}: ${f}`);
  for (const k of Object.keys(baselineMap)) if (!findings.includes(k)) stale.push(`${label}: ${k}`);
  return { errors, stale };
}

/** A count rule: a count above its baseline fails; a count below it is stale (prune it down). */
export function compareCounts(label, counts, baselineMap = {}) {
  const errors = [];
  const stale = [];
  for (const [f, n] of Object.entries(counts)) {
    const allowed = baselineMap[f]?.count ?? 0;
    if (n > allowed) errors.push(`${label}: ${f} has ${n} (baseline allows ${allowed})`);
  }
  for (const [f, entry] of Object.entries(baselineMap)) {
    if ((counts[f] ?? 0) < entry.count)
      stale.push(`${label}: ${f} now has ${counts[f] ?? 0} (baseline ${entry.count})`);
  }
  return { errors, stale };
}

/** Runs every rule against the repo and the baseline. */
export function check(root = ROOT, baseline = readBaseline(root)) {
  const files = walk(root, APP);
  const read = (f) => readFileSync(path.join(root, f), 'utf8');
  const html = files.filter((f) => f.endsWith('.html')).map((f) => [f, read(f)]);
  const sources = files
    .filter((f) => f.endsWith('.html') || (f.endsWith('.ts') && !/\.(spec|stories)\.ts$/.test(f)))
    .map((f) => [f, read(f)]);
  const routeFiles = files.filter((f) => f.endsWith('.routes.ts')).map((f) => [f, read(f)]);
  const tokens = rootColorTokens(read('src/styles/styles.css'));

  const hard = [
    ...suffixedFiles(files).map(
      (f) => `Suffixed file name (use v20+ names, no .component/.service…): ${f}`,
    ),
    ...scssFiles(files).map((f) => `No .scss: ${f}`),
    ...singularFolders(files).map(
      (d) => `Singular category folder (folder names are plural): ${d}`,
    ),
    ...nestedShared(files).map(
      (d) =>
        `No shared/ layer inside a feature — place code at the lowest level that uses it: ${d}`,
    ),
    ...v2Paths(files).map((f) => `No -v2 names after a cutover: ${f}`),
    ...deferWithoutPlaceholder(html).map((f) => `@defer without a sized @placeholder: ${f}`),
  ];

  const lists = [
    compareList(
      'Routed component outside pages/',
      routedOutsidePages(routeFiles),
      baseline.routedOutsidePages,
    ),
    compareList(
      'Component stylesheet without a baseline reason (AGENTS.md §4.6: keyframes, third-party DOM, :host/pseudo rules, PDF DOM only)',
      componentStylesheets(files),
      baseline.componentStylesheets,
    ),
  ];
  const counts = [
    compareCounts(
      'Static style="…" attribute (use a Tailwind utility)',
      inlineStyleCounts(html),
      baseline.inlineStyles,
    ),
    compareCounts(
      'Hardcoded colour equal to a @theme token (use the token utility)',
      tokenHexCounts(sources, tokens),
      baseline.tokenHex,
    ),
  ];

  const errors = [...hard, ...lists.flatMap((r) => r.errors), ...counts.flatMap((r) => r.errors)];
  const stale = [...lists.flatMap((r) => r.stale), ...counts.flatMap((r) => r.stale)];
  return { errors, stale, findings: { routeFiles, files, html, sources, tokens } };
}

function readBaseline(root) {
  return JSON.parse(readFileSync(path.join(root, BASELINE), 'utf8'));
}

/** Shrink the baseline to reality: drop fixed entries, lower counts. Never adds or raises. */
export function prune(root = ROOT) {
  const baseline = readBaseline(root);
  const { findings } = check(root, baseline);
  const { files, html, sources, routeFiles, tokens } = findings;
  const keep = (map, live) =>
    Object.fromEntries(Object.entries(map ?? {}).filter(([k]) => live.includes(k)));
  const lower = (map, live) =>
    Object.fromEntries(
      Object.entries(map ?? {})
        .filter(([k]) => live[k])
        .map(([k, v]) => [k, { ...v, count: Math.min(v.count, live[k]) }]),
    );
  const next = {
    ...baseline,
    routedOutsidePages: keep(baseline.routedOutsidePages, routedOutsidePages(routeFiles)),
    componentStylesheets: keep(baseline.componentStylesheets, componentStylesheets(files)),
    inlineStyles: lower(baseline.inlineStyles, inlineStyleCounts(html)),
    tokenHex: lower(baseline.tokenHex, tokenHexCounts(sources, tokens)),
  };
  writeFileSync(path.join(root, BASELINE), JSON.stringify(next, null, 2) + '\n');
}

// ---------------------------------------------------------------- CLI

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--prune')) {
    prune();
    console.log(`Pruned ${BASELINE}.`);
  }
  const { errors, stale } = check();
  if (stale.length) {
    console.error(
      `✖ ${BASELINE} is out of date — these improved. Run: node scripts/check-structure.mjs --prune\n`,
    );
    for (const s of stale) console.error(`  ${s}`);
  }
  if (errors.length) {
    console.error(`\n✖ Structure check: ${errors.length} violation(s). See AGENTS.md §3–§4.\n`);
    for (const e of errors) console.error(`  ${e}`);
  }
  if (errors.length || stale.length) process.exit(1);
  console.log('✔ Structure check passed.');
}
