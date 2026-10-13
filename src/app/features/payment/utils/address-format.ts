import { Address } from '@features/payment/models/commerce.model';

/** One line for an address card or the review page: the filled parts, comma-separated. */
export function formatAddress(a: Address): string {
  return [a.line1, a.line2, a.landmark, a.city, a.state, a.country, a.postal_code]
    .filter(Boolean)
    .join(', ');
}
