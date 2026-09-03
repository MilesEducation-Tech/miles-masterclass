# prompts/

Approved implementation plans, one file per feature. This is the review gate in the
[AGENTS.md](../AGENTS.md) §1 workflow: the agent writes the plan here, a human reads it and
approves, and only then does code get written.

## The loop

1. **You** send a short prompt — one feature, plus the skills it needs.
   ```
   Implement the reel bookmark toggle.
   Use .claude/skills/micro-learning and .claude/skills/core-services.
   ```
2. **The agent** reads AGENTS.md + the named skills, inspects the real code, and writes
   `prompts/<feature-name>.md` from [`_TEMPLATE.md`](_TEMPLATE.md).
3. **You** read the plan — especially **Assumptions** and **How to verify it**.
4. **You** approve with a plain "yes."
5. **The agent** implements, runs the checks, and shares the exact test steps.
6. **You** verify, then move to the next feature.

You review the prompt, not the keystrokes. You own the decisions; the agent owns the typing.

## Writing the short prompt

One feature per prompt. Name the skills. Let the rules stay in AGENTS.md.

|     |                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------- |
| ❌  | "Build the whole payment flow — cart, coupons, checkout, orders and invoices."                                       |
| ❌  | Re-explaining conventions that already live in AGENTS.md.                                                            |
| ❌  | "Make the tracker page better."                                                                                      |
| ✅  | "Implement the coupon-apply step on the cart page. Use `.claude/skills/payment` and `.claude/skills/ui-components`." |
| ✅  | "Add the CPE-credits column to the tracker table. Use `.claude/skills/cpe-tracker`."                                 |

## 60-second checklist before you approve

- [ ] Is the feature defined clearly enough to direct, not script?
- [ ] Do the rules it needs already live in AGENTS.md?
- [ ] Are the right skills named in the prompt?
- [ ] Did the agent save a plan here and actually ask for approval?
- [ ] Did I read the plan — including Assumptions and the test steps?
- [ ] Are the server/client boundary and secrets handled (AGENTS.md §7)?

Six yeses → say "yes" and let it build.

## Build-in-order

When starting something large, build in this order so you're never deciding UI before you know
the data, or wiring an integration before the thing it depends on exists:

1. Design tokens / shared UI → 2. Core screens on placeholder data → 3. Auth →
2. Data model + API contract → 5. Read path (wire real data) → 6. Core behaviour →
3. Derived features (search, reports, analytics) → 8. Automation → 9. Deploy, then harden.

Each step gets its own short prompt and its own approved plan. Verify each before starting the next.

## Housekeeping

Keep plans for work in flight. Once a feature has shipped and been verified, delete its file —
this folder is a queue, not an archive. Git history holds what shipped.
