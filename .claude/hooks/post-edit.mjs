#!/usr/bin/env node
// PostToolUse(Edit|Write|MultiEdit): runs Prettier on the edited file, then ESLint on src ts/html.
// Lint errors are sent back to Claude (exit 2) so it fixes them immediately.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const file = input?.tool_input?.file_path;
if (!file) process.exit(0);
const abs = resolve(root, file);
const rel = relative(root, abs).split('\\').join('/');
if (!existsSync(abs) || rel.startsWith('docs/refactor/.cache') || rel.startsWith('..')) process.exit(0);
if (!/\.(ts|html|css|json|md|mjs)$/.test(rel)) process.exit(0);

const isWin = process.platform === 'win32';
const run = (args) => spawnSync('pnpm', args, { cwd: root, encoding: 'utf8', shell: isWin });

run(['exec', 'prettier', '--write', '--log-level', 'warn', abs]);

if (/^src\/.*\.(ts|html)$/.test(rel)) {
  const lint = run(['exec', 'eslint', '--no-warn-ignored', abs]);
  if (lint.status !== 0) {
    const out = `${lint.stdout}\n${lint.stderr}`.trim().split('\n').slice(-40).join('\n');
    process.stderr.write(`ESLint errors in ${rel} (fix before moving on):\n${out}\n`);
    process.exit(2);
  }
}
process.exit(0);
