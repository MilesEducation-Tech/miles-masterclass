import { HomePrice, HomeWebinar } from '@features/home/models/home-sections.model';

/** The US card: a monthly headline with the yearly figure under "Or". */
export const MOCK_HOME_PRICE_US: HomePrice = {
  primary: {
    amount: 79,
    currency: 'USD',
    suffix: ' / month',
    baseAmount: null,
    discountPercent: 0,
    commitmentMonths: 12,
    label: 'Monthly',
  },
  secondary: {
    amount: 948,
    currency: 'USD',
    suffix: ' / year',
    baseAmount: null,
    discountPercent: 0,
    commitmentMonths: 0,
    label: 'Yearly',
  },
  currencies: 'USD',
};

/** A single discounted yearly card, as a country without monthly billing shows. */
export const MOCK_HOME_PRICE_YEARLY_DISCOUNT: HomePrice = {
  primary: {
    amount: 2999,
    currency: 'AED',
    suffix: ' / year',
    baseAmount: 3499,
    discountPercent: 14,
    commitmentMonths: 0,
    label: 'Yearly — paid once',
  },
  secondary: null,
  currencies: 'AED',
};

/** The highlighted "AI in Accounting 101" webinar with a session next week. */
export const MOCK_HOME_WEBINAR: HomeWebinar = {
  id: 101,
  title: 'AI in Accounting 101: Build Your First AI Agent',
  overview:
    'A free, hands-on hour: pick an accounting workflow, build an agent for it on Miles AI Labs, and leave with 1 CPE credit.',
  banner:
    'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/home-v3/pricing-app-icon.webp',
  sessionStart: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
};
