import { InjectionToken, Type } from '@angular/core';

/**
 * Loaders for dialogs that LIVE in a feature but are OPENED from outside it.
 *
 * Why tokens and not a plain `import()`: **deferring an import does not satisfy
 * `boundaries/dependencies`.** The rule's `dependency-nodes` include
 * `dynamic-import`, so `await import('@features/payment/...')` from `shared/` is
 * reported exactly like a static import. The edge has to be inverted, not
 * delayed — which is also why PROMPT.md §4.5's `injectAsync` approach does not,
 * on its own, clear these violations.
 *
 * Each token is bound in **two** places, and both are required:
 *   - `app.config.ts` — the running app. That file is element `app-root`, which
 *     the boundaries config gives no outbound policy, so the composition root is
 *     the one place allowed to name both sides.
 *   - `src/test-setup.ts` — specs get no app config, so without it every suite
 *     that injects the consumer dies with `NG0201`.
 *
 * The `import()` lives at the binding site, so these dialogs stay in their lazy
 * chunks and never reach the initial bundle.
 */

/** The payment cart drawer, opened from `shared/services/utils.ts`. */
export const CART_DRAWER_DIALOG = new InjectionToken<() => Promise<Type<unknown>>>(
  'CART_DRAWER_DIALOG',
);

/**
 * The payment subscription dialog, opened from `shared/services/utils.ts` and
 * `shared/services/engagement-dialog.ts`.
 *
 * It lives in `features/payment/dialogs/` because it renders `PlanSelectionCard`
 * as a template import, and a template import cannot be hidden behind a token —
 * so the component itself had to move to the feature that owns it.
 */
export const SUBSCRIPTION_DIALOG = new InjectionToken<() => Promise<Type<unknown>>>(
  'SUBSCRIPTION_DIALOG',
);
