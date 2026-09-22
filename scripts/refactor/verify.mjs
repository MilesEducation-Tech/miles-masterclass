#!/usr/bin/env node
/**
 * Refactor verification gates.
 *
 *   node scripts/refactor/verify.mjs                     full gates (end of phase / feature)
 *   node scripts/refactor/verify.mjs --quick             typecheck + lint (after every step)
 *   node scripts/refactor/verify.mjs --record-baseline   USER ONLY: full gates, then record SSR + bundle baselines
 *
 * Optional flags: --no-storybook, --no-ssr
 * Logs:    docs/refactor/.cache/verify-<gate>.log
 * Summary: docs/refactor/.cache/last-verify.json
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = new Set(process.argv.slice(2));
const CACHE = 'docs/refactor/.cache';
mkdirSync(CACHE, { recursive: true });

const isWin = process.platform === 'win32';
const record = argv.has('--record-baseline');
const quick = argv.has('--quick');

const gates = quick
  ? [
      { name: 'typecheck', cmd: 'pnpm', args: ['exec', 'tsc', '-p', 'tsconfig.app.json', '--noEmit', '--pretty', 'false'] },
      { name: 'lint', cmd: 'pnpm', args: ['lint'] },
    ]
  : [
      { name: 'lint', cmd: 'pnpm', args: ['lint'] },
      { name: 'unit tests', cmd: 'pnpm', args: ['ng', 'test', '--watch=false'] },
      { name: 'build (local)', cmd: 'pnpm', args: ['build'] },
      // Prod build runs last among builds so dist/ holds the production output for the bundle + SSR gates.
      { name: 'build (prod)', cmd: 'pnpm', args: ['build:prod'] },
      ...(argv.has('--no-storybook') ? [] : [{ name: 'storybook build', cmd: 'pnpm', args: ['build-storybook'] }]),
      { name: 'format check', cmd: 'pnpm', args: ['format'] },
      {
        name: 'bundle report',
        cmd: 'node',
        args: ['scripts/refactor/bundle-report.mjs', ...(record ? ['--record'] : [])],
        needs: 'build (prod)',
      },
      ...(argv.has('--no-ssr')
        ? []
        : [
            {
              name: 'ssr smoke',
              cmd: 'node',
              args: ['scripts/refactor/ssr-smoke.mjs', ...(record ? ['--record'] : [])],
              needs: 'build (prod)',
            },
          ]),
    ];

const results = [];
for (const gate of gates) {
  if (gate.needs && results.find((r) => r.name === gate.needs)?.status !== 'pass') {
    results.push({ name: gate.name, status: 'skipped', note: `needs "${gate.needs}"` });
    console.log(`⏭  ${gate.name} (skipped: needs "${gate.needs}")`);
    continue;
  }
  const started = Date.now();
  process.stdout.write(`▶  ${gate.name} … `);
  const run = spawnSync(gate.cmd, gate.args, {
    encoding: 'utf8',
    shell: isWin,
    maxBuffer: 512 * 1024 * 1024,
    env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}${run.error ? `\n${run.error.message}` : ''}`;
  const log = join(CACHE, `verify-${gate.name.replace(/\W+/g, '-')}.log`);
  writeFileSync(log, output);
  const status = run.status === 0 ? 'pass' : 'fail';
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`${status === 'pass' ? '✅' : '❌'} ${seconds}s`);
  results.push({
    name: gate.name,
    status,
    seconds,
    log,
    tail: status === 'fail' ? output.trim().split('\n').slice(-60).join('\n') : undefined,
  });
}

const failed = results.filter((r) => r.status !== 'pass');
const summary = {
  mode: quick ? 'quick' : record ? 'record-baseline' : 'full',
  at: new Date().toISOString(),
  ok: failed.length === 0,
  results,
};
writeFileSync(join(CACHE, 'last-verify.json'), JSON.stringify(summary, null, 2));

console.log('\n| Gate | Result | Time |\n|---|---|---|');
for (const r of results) console.log(`| ${r.name} | ${r.status} | ${r.seconds ?? '-'}s |`);

for (const r of failed.filter((f) => f.tail)) {
  console.log(`\n──── ${r.name} (last 60 lines; full log: ${r.log}) ────\n${r.tail}`);
}
console.log(summary.ok ? '\nALL GATES GREEN' : `\n${failed.length} GATE(S) NOT GREEN`);
process.exit(summary.ok ? 0 : 1);
