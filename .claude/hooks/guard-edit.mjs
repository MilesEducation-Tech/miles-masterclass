#!/usr/bin/env node
// PreToolUse(Edit|Write|MultiEdit|NotebookEdit): protects harness-owned and secret files, and blocks
// NEW suppressions (eslint-disable, ts-ignore, skipped/focused tests) and banned APIs in source files.
// Content checks compare counts against the existing content, so moving code that already has them is allowed.
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const ti = input.tool_input ?? {};
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const file = ti.file_path ?? ti.notebook_path ?? '';
if (!file) process.exit(0);
const abs = resolve(root, file);
const rel = relative(root, abs).split('\\').join('/');

const block = (msg) => {
  process.stderr.write(`BLOCKED by refactor harness (${rel}): ${msg}\n`);
  process.exit(2);
};

const protectedPaths = [
  [/^\.claude\//, 'Harness config is owned by the user.'],
  [/^scripts\/refactor\//, 'Verification scripts are owned by the user; gates are never weakened.'],
  [/^docs\/refactor\/(PROMPT\.md|baseline\/)/, 'The spec and baselines are owned by the user.'],
  [/(^|\/)\.env(\.|$)/, 'Env files are off-limits.'],
  [/^(postman|Postman Collection)\/.*environment/i, 'Postman environments may contain secrets.'],
  [/^pnpm-lock\.yaml$/, 'Change dependencies with pnpm, not by editing the lockfile.'],
];
for (const [re, msg] of protectedPaths) if (re.test(rel)) block(msg);

// Content checks only apply to source code, not docs/reports/markdown.
if (!/^src\/.*\.(ts|html|css|mjs|js)$/.test(rel) && !/^eslint\.config\.mjs$/.test(rel)) process.exit(0);

const edits = Array.isArray(ti.edits) ? ti.edits : [];
const added = [ti.new_string, ti.content, ...edits.map((e) => e.new_string)].filter(Boolean).join('\n');
const removed = [ti.old_string, ...edits.map((e) => e.old_string)].filter(Boolean).join('\n');
const existing = ti.content !== undefined ? (existsSync(abs) ? readFileSync(abs, 'utf8') : '') : removed;
const count = (s, re) => (s.match(re) ?? []).length;

const forbidden = [
  [/eslint-disable/g, 'Do not disable lint rules. Fix the code or report it as a decision.'],
  [/@ts-(ignore|nocheck|expect-error)/g, 'Do not suppress type errors.'],
  [/\b(it|test|describe)\.(skip|only|todo)\s*\(/g, 'Do not skip or focus tests.'],
  [/\b[xf](it|describe)\s*\(/g, 'Do not skip or focus tests.'],
  [/\[ngClass\]|\[ngStyle\]|\bNgClass\b|\bNgStyle\b/g, 'NgClass/NgStyle are banned. Use [class] bindings or cn().'],
  [/from\s+['"]@angular\/aria/g, '@angular/aria is not used. Build on ng-primitives.'],
  [/\blocalStorage\b|\bsessionStorage\b/g, 'New direct browser storage access is not allowed; use the storage service (SSR-safe).'],
];
for (const [re, msg] of forbidden) if (count(added, re) > count(existing, re)) block(msg);

process.exit(0);
