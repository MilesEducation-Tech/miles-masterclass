/**
 * The user's current subscription, as the old backend's `GET /current-plan/` returned it.
 * Lived in `auth.model.ts` until the auth layer was removed.
 *
 * The last legacy payment type. The certificate access policy and the engagement
 * dialog still take it (always `null` today); it goes when CAIRA ships a learner
 * subscription-status endpoint (`prompts/commerce-api-rebind.md`, backend Q3). Commerce
 * types live in `core/models/commerce.model.ts` and `features/payment/models/`.
 */
export interface CurrentPlanData {
  id: number;
  remaining_days: number;
  paid_amount: number;
  transaction_mode: string;
  subscription_status: string;
  trial_duration: number | null;
  current_time: string;
  platform: string;
  valid_from: string;
  valid_to: string;
}
