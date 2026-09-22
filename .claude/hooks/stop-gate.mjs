#!/usr/bin/env node
// Stop: while the refactor is active, Claude may only stop at a green step boundary with STATE.md updated.
// Uses stop_hook_active to avoid loops: the second stop attempt in a row is always allowed.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
if (input.stop_hook_active) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const STATE = join(root, 'docs/refactor/STATE.md');
if (!existsSync(STATE)) process.exit(0); // harness not active

const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
const changed = (status.stdout ?? '')
  .split('\n')
  .filter(Boolean)
  .map((l) => l.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, ''))
  .filter((p) => /^(src\/|angular\.json|tsconfig|eslint\.config|package\.json|\.storybook\/)/.test(p));
if (!changed.length) process.exit(0);

const problems = [];
const newestChange = Math.max(0, ...changed.map((p) => (existsSync(join(root, p)) ? statSync(join(root, p)).mtimeMs : 0)));
if (statSync(STATE).mtimeMs < newestChange) {
  problems.push('docs/refactor/STATE.md is older than your latest source changes. Update "Now" and the step log.');
}

const isWin = process.platform === 'win32';
const tc = spawnSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.app.json', '--noEmit', '--pretty', 'false'], {
  cwd: root,
  encoding: 'utf8',
  shell: isWin,
});
if (tc.status !== 0) {
  const tail = `${tc.stdout}\n${tc.stderr}`.trim().split('\n').slice(-25).join('\n');
  problems.push(
    `Typecheck fails. Stop only at a green step boundary, or record the blocker in STATE.md and stop again:\n${tail}`,
  );
}

if (problems.length) {
  process.stderr.write(`Refactor stop gate:\n- ${problems.join('\n- ')}\n`);
  process.exit(2);
}
process.exit(0);
