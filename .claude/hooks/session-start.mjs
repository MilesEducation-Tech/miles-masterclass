#!/usr/bin/env node
// SessionStart (startup, resume, clear, compact): injects the current refactor state as context.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE = join(root, 'docs/refactor/STATE.md');
if (!existsSync(STATE)) process.exit(0);

const state = readFileSync(STATE, 'utf8');
process.stdout.write(
  [
    'The structure refactor harness is active in this repository.',
    'The spec is docs/refactor/PROMPT.md; phases run through /refactor-phase <n> [feature].',
    'Current contents of docs/refactor/STATE.md:',
    '',
    state.length > 8000 ? `${state.slice(0, 8000)}\n…(truncated; read the file for the rest)` : state,
  ].join('\n'),
);
