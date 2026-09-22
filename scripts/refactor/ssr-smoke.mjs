#!/usr/bin/env node
/**
 * SSR smoke test against the production server build.
 *
 *   node scripts/refactor/ssr-smoke.mjs            compare against docs/refactor/baseline/ssr.json
 *   node scripts/refactor/ssr-smoke.mjs --record   USER ONLY: record the baseline
 *
 * Routes live in docs/refactor/smoke-routes.json. The server must honor process.env.PORT
 * (the Angular SSR template does).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync('docs/refactor/smoke-routes.json', 'utf8'));
const record = process.argv.includes('--record');
const BASELINE = 'docs/refactor/baseline/ssr.json';
const tolerance = cfg.textTolerance ?? 0.15;

if (cfg.routes.some((r) => r.includes('<'))) {
  console.error('Fill in the placeholder routes in docs/refactor/smoke-routes.json first.');
  process.exit(1);
}
if (!existsSync(cfg.server)) {
  console.error(`No server bundle at ${cfg.server}. Run "pnpm build:prod" first.`);
  process.exit(1);
}

const base = `http://localhost:${cfg.port}`;
const server = spawn(process.execPath, [cfg.server], {
  env: { ...process.env, PORT: String(cfg.port), NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
const stopServer = () => {
  try {
    server.kill();
  } catch {}
};
process.on('exit', stopServer);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitUntilUp() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`SSR server exited early:\n${serverLog.slice(-3000)}`);
    try {
      await fetch(`${base}/`, { redirect: 'manual' });
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`SSR server did not respond within 45s:\n${serverLog.slice(-3000)}`);
}

const clean = (s) => (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const first = (html, re) => clean(html.match(re)?.[1]);
const meta = (html, name) =>
  first(html, new RegExp(`<meta[^>]+name="${name}"[^>]+content="([^"]*)"`, 'i')) ||
  first(html, new RegExp(`<meta[^>]+content="([^"]*)"[^>]+name="${name}"`, 'i'));

function snapshot(res, html) {
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  return {
    status: res.status,
    location: res.headers.get('location'),
    title: first(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: meta(html, 'description'),
    canonical:
      first(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i) ||
      first(html, /<link[^>]+href="([^"]*)"[^>]+rel="canonical"/i),
    h1: first(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
    jsonLdBlocks: (html.match(/application\/ld\+json/gi) ?? []).length,
    textLength: clean(body).length,
  };
}

const STRICT = ['status', 'location', 'title', 'description', 'canonical', 'h1', 'jsonLdBlocks'];
let ok = true;

try {
  await waitUntilUp();
  const current = {};
  for (const route of cfg.routes) {
    const res = await fetch(base + route, { redirect: 'manual' });
    current[route] = snapshot(res, await res.text());
  }

  if (record) {
    mkdirSync('docs/refactor/baseline', { recursive: true });
    writeFileSync(BASELINE, JSON.stringify(current, null, 2));
    console.log(`Baseline recorded → ${BASELINE}`);
    for (const [route, s] of Object.entries(current)) console.log(`  ${route}  ${s.status}  "${s.title}"`);
  } else {
    if (!existsSync(BASELINE)) {
      console.error(`No baseline at ${BASELINE}. The user must run: node scripts/refactor/verify.mjs --record-baseline`);
      process.exit(1);
    }
    const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
    for (const route of cfg.routes) {
      const b = baseline[route];
      const c = current[route];
      if (!b) {
        console.log(`WARN ${route}: not in baseline (the user should re-record)`);
        continue;
      }
      const diffs = STRICT.filter((k) => (b[k] ?? null) !== (c[k] ?? null)).map(
        (k) => `${k}: "${b[k]}" → "${c[k]}"`,
      );
      const drift = b.textLength ? Math.abs(c.textLength - b.textLength) / b.textLength : 0;
      if (drift > tolerance) diffs.push(`textLength: ${b.textLength} → ${c.textLength} (${(drift * 100).toFixed(1)}%)`);
      if (diffs.length) {
        ok = false;
        console.log(`FAIL ${route}\n  ${diffs.join('\n  ')}`);
      } else {
        console.log(`OK   ${route}  ${c.status}  "${c.title}"`);
      }
    }
  }
} catch (err) {
  ok = false;
  console.error(String(err?.message ?? err));
} finally {
  stopServer();
}
process.exit(ok ? 0 : 1);
