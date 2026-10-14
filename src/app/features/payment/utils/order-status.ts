/** The three faces of `app-payment-status`. */
export type PaymentDisplayStatus = 'success' | 'pending' | 'cancelled';

/**
 * CAIRA's order status as `app-payment-status` shows it. Takes a plain string because the
 * invoice also reads the `?status=` hint our Stripe-return redirect puts on the URL; anything
 * unknown reads as pending until the order itself arrives.
 */
export function paymentDisplayStatus(status: string | null | undefined): PaymentDisplayStatus {
  switch (status) {
    case 'paid':
      return 'success';
    case 'failed':
    case 'cancelled':
    case 'partial_cancelled':
    case 'refunded':
    case 'partial_refunded':
      return 'cancelled';
    default:
      return 'pending';
  }
}
