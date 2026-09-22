#!/usr/bin/env node
// PreToolUse(Bash): blocks commits, destructive git, schematics, npm/yarn, baseline re-recording,
// and shell writes to harness-owned files. Exit 2 = block, and stderr is shown to Claude.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const cmd = String(input?.tool_input?.command ?? '');

const block = (msg) => {
  process.stderr.write(`BLOCKED by refactor harness: ${msg}\n`);
  process.exit(2);
};

const rules = [
  [/\bgit\s+commit\b/, 'Never commit. Leave changes uncommitted and give the user a commit message.'],
  [/\bgit\s+push\b/, 'Never push.'],
  [
    /\bgit\s+(reset\s+--hard|clean\s+-\w*f|checkout\s+--\s|checkout\s+\.|restore\s+(--staged\s+)?\.|stash\s+(drop|clear)|rebase|merge|branch\s+-D|tag\b)/,
    'Destructive or history-changing git command. Ask the user to do this.',
  ],
  [/--no-verify\b/, 'Do not bypass git hooks.'],
  [/\bng\s+(update|generate|g)\b/, 'Angular schematics and migrations are not allowed in this refactor.'],
  [/(^|[;&|]\s*)(npm|yarn|npx)\s/, 'Use pnpm (pnpm, pnpm exec, pnpm dlx).'],
  [/--record(-baseline)?\b/, 'Only the user records baselines. Report the need in STATE.md instead.'],
  [/\brm\s+-\w*r\w*\s+(\/|~|\.\/?\s*$|src\/?\s*$)/, 'Refusing a broad recursive delete.'],
];
for (const [re, msg] of rules) if (re.test(cmd)) block(msg);

// Shell writes/moves/deletes touching harness-owned paths.
const owned = /(\.claude\/|scripts\/refactor\/|docs\/refactor\/PROMPT\.md|docs\/refactor\/baseline)/;
const writes = /(>|\btee\b|\bsed\s+-i|\bperl\s+-\w*i|\brm\b|\bmv\b|\bcp\b|\bgit\s+(mv|rm)\b|\btruncate\b)/;
if (owned.test(cmd) && writes.test(cmd)) block('Harness files (.claude/, scripts/refactor/, PROMPT.md, baselines) are owned by the user.');

process.exit(0);
