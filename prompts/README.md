# prompts/

Approved implementation plans, one file per feature. This is the review gate in the
[AGENTS.md](../AGENTS.md) §1 workflow: the agent writes the plan here, a human reads it and
approves, and only then does code get written.

## The loop

1. **You** send a short prompt — one feature, and the area it touches.
   ```
   Implement the reel bookmark toggle.
   ```
2. **The agent** reads AGENTS.md + [`docs/STRUCTURE.md`](../docs/STRUCTURE.md), inspects the real
   code, and writes `prompts/<feature-name>.md` from [`_TEMPLATE.md`](_TEMPLATE.md).
3. **You** read the plan — especially **Assumptions** and **How to verify it**.
4. **You** approve with a plain "yes."
5. **The agent** implements, runs the checks, and shares the exact test steps.
6. **You** verify, then move to the next feature.

You review the prompt, not the keystrokes. You own the decisions; the agent owns the typing.

## Writing the short prompt

One feature per prompt. Let the rules stay in AGENTS.md and the shapes in `docs/STRUCTURE.md`.

> The repo-specific skills this file used to name were deleted in `c31f69d`. Their structural
> content is now in [`docs/STRUCTURE.md`](../docs/STRUCTURE.md); you no longer name skills in the
> prompt.

|     |                                                                                |
| --- | ------------------------------------------------------------------------------ |
| ❌  | "Build the whole payment flow — cart, coupons, checkout, orders and invoices." |
| ❌  | Re-explaining conventions that already live in AGENTS.md.                      |
| ❌  | "Make the tracker page better."                                                |
| ✅  | "Implement the coupon-apply step on the cart page."                            |
| ✅  | "Add the CPE-credits column to the tracker table."                             |

## 60-second checklist before you approve

- [ ] Is the feature defined clearly enough to direct, not script?
- [ ] Do the rules it needs already live in AGENTS.md or `docs/STRUCTURE.md`?
- [ ] Does the plan follow the endpoint-binding recipe (`docs/STRUCTURE.md` §3)?
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
