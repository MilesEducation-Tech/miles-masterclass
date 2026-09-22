---
name: refactor-verify
description: Run the full refactor verification gates through the verifier subagent and summarize the result. Usage /refactor-verify [--quick]
argument-hint: [--quick]
disable-model-invocation: true
---

Ask the `verifier` subagent to run `node scripts/refactor/verify.mjs $ARGUMENTS` and return its summary.
Show the user the gate table and, for each failing gate, the first actionable errors with file:line.
Do not fix anything unless the user asks. Record the result in the "Last verify" line of `docs/refactor/STATE.md`.
