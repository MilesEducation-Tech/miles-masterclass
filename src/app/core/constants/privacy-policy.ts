import { LegalDoc } from '../models/legal-doc.model';
import { richContent } from '../models/faq.model';
import { CountryCode, ProfessionType } from '../models/route-params.model';
import { LocaleKey, resolveByLocale } from '@core/utils/locale-resolver';

/**
 * Privacy Policy content. Ported from v1's TERMS_AND_CONDITIONS array
 * (the "Miles Masterclass Privacy Policy" root) and converted from raw HTML
 * to FAQContent[]. Nested a)/b)/c)-style subsections are preserved at
 * `level: 3` and don't appear in the side menu (only top-level navIds do).
 *
 * Locale variations: pages consume `resolvePrivacyPolicy(country, profession)`.
 * Add per-locale overrides to LOCALE_OVERRIDES below when copy diverges.
 *
 * Stable navIds — see comment in [terms-of-service.ts] before renaming.
 */
const DEFAULT_PRIVACY_POLICY: LegalDoc = {
  slug: 'privacy-policy',
  title: 'Miles Masterclass Privacy Policy',
  lastUpdated: '2025-09-30',
  intro: [
    {
      type: 'text',
      value:
        'Miles Masterclass Inc. (“we,” “our,” or “us”) values your privacy. This Privacy Policy explains how we collect, use, store, and share personal and professional information when you use our website (milesmasterclass.com) or mobile app (the “Services”).',
    },
    { type: 'text', value: 'By using the Services, you consent to this Privacy Policy.' },
  ],
  sections: [
    {
      navId: 'information-we-collect',
      navLabel: 'Information We Collect',
      title: '1. Information We Collect',
      level: 2,
      body: [],
      sections: [
        {
          navId: 'account-registration-data',
          navLabel: 'Account & Registration Data',
          title: 'a) Account & Registration Data',
          level: 3,
          body: [
            {
              type: 'list',
              items: [
                'Name, email, phone number',
                'Professional qualifications and certifications',
                'Employer, job role, sector, experience',
                'Location, state board details (if applicable, e.g., CPA)',
              ],
            },
          ],
        },
        {
          navId: 'usage-learning-data',
          navLabel: 'Usage & Learning Data',
          title: 'b) Usage & Learning Data',
          level: 3,
          body: [
            {
              type: 'list',
              items: [
                'Course progress, learning history, completed modules',
                'Certificates earned (NASBA CPE compliance, only if course completed per NASBA rules – refer to the Credits & Reporting FAQ)',
                'Interactions with webinars, podcasts, and micro-learning content',
              ],
            },
          ],
        },
        {
          navId: 'payment-data',
          navLabel: 'Payment Data',
          title: 'c) Payment Data',
          level: 3,
          body: [
            {
              type: 'text',
              value: 'Collected via third-party processors (e.g., Stripe, App Store, Google Play).',
            },
            { type: 'text', value: 'Full credit card data not stored by Miles Masterclass.' },
          ],
        },
      ],
    },
    {
      navId: 'automated-collection',
      navLabel: 'Automated Collection',
      title: '2. Information We Collect Through Automated Means',
      level: 2,
      body: [],
      sections: [
        {
          navId: 'websites',
          navLabel: 'Websites',
          title: 'a) Websites',
          level: 3,
          body: [
            {
              type: 'list',
              items: [
                'IP address, pages visited, click counts, order of page views',
                'Date and time of use, content watched, total minutes watched, error logs',
              ],
            },
          ],
        },
        {
          navId: 'mobile-applications',
          navLabel: 'Mobile Applications',
          title: 'b) Mobile Applications',
          level: 3,
          body: [
            {
              type: 'list',
              items: [
                'Device identifiers, IP address, OS, app version, update history',
                'Date and time of use, content watched, total minutes watched, error logs',
              ],
            },
          ],
        },
        {
          navId: 'location-information',
          navLabel: 'Location Information',
          title: 'c) Location Information',
          level: 3,
          body: [
            {
              type: 'text',
              value: 'General location based on IP address (city/state/postal code).',
            },
          ],
        },
      ],
    },
    {
      navId: 'others',
      navLabel: 'Information from Others',
      title: '3. Information We Collect from Others',
      level: 2,
      body: [
        {
          type: 'text',
          value:
            'Demographic and statistical information from third parties (partners, marketers, researchers).',
        },
        {
          type: 'text',
          value:
            'Combined with your usage data to derive interests, personalize experience, improve analytics, products, and advertising.',
        },
      ],
    },
    {
      navId: 'how-we-use',
      navLabel: 'How We Use Information',
      title: '4. How We Use Your Information',
      level: 2,
      body: [],
      sections: [
        {
          navId: 'providing-services',
          navLabel: 'Providing the Services',
          title: 'a) Providing the Services',
          level: 3,
          body: [
            {
              type: 'list',
              items: [
                'Complete purchases, deliver subscriptions, issue NASBA CPE certificates',
                'Communicate updates, course information, and technical notices',
              ],
            },
          ],
        },
        {
          navId: 'marketing',
          navLabel: 'Marketing & Personalization',
          title: 'b) Marketing & Content Personalization',
          level: 3,
          body: [
            {
              type: 'list',
              items: [
                'Email, SMS, WhatsApp, push notifications, and in-app messages',
                'Customize advertising/content based on interests',
                'Future communication partners may be engaged at our discretion; information may be shared solely for communications purposes',
              ],
            },
          ],
        },
        {
          navId: 'business-operations',
          navLabel: 'Business Operations',
          title: 'c) Business Operations',
          level: 3,
          body: [
            {
              type: 'list',
              items: [
                'Research, analytics, reports, testing new features',
                'Fraud prevention, app stability, security monitoring',
              ],
            },
          ],
        },
        {
          navId: 'legal-compliance',
          navLabel: 'Legal & Compliance',
          title: 'd) Legal & Compliance',
          level: 3,
          body: [
            {
              type: 'text',
              value:
                'Comply with legal processes, enforce Terms, protect rights, respond to claims.',
            },
          ],
        },
      ],
    },
    {
      navId: 'combined-aggregate',
      navLabel: 'Combined & Aggregate',
      title: '5. Combined & Aggregate Information',
      level: 2,
      body: [
        {
          type: 'text',
          value:
            'We may combine information from multiple sources for analytics, product improvement, or marketing.',
        },
        {
          type: 'text',
          value:
            'Aggregate or de-identified information may be disclosed publicly or to partners without identifying individuals.',
        },
      ],
    },
    {
      navId: 'cookies',
      navLabel: 'Cookies',
      title: '6. Cookies & Similar Technologies',
      level: 2,
      body: [],
      sections: [
        {
          navId: 'essential-cookies',
          navLabel: 'Essential Cookies',
          title: 'a) Essential Cookies',
          level: 3,
          body: [
            {
              type: 'text',
              value: 'Necessary for login, course access, subscription management.',
            },
            { type: 'text', value: 'Collected even if other cookies are rejected.' },
          ],
        },
        {
          navId: 'performance-cookies',
          navLabel: 'Performance & Analytics',
          title: 'b) Performance & Analytics Cookies',
          level: 3,
          body: [
            { type: 'text', value: 'Track platform performance, usage trends, improve Service.' },
          ],
        },
        {
          navId: 'functional-cookies',
          navLabel: 'Functional / Preference',
          title: 'c) Functional / Preference Cookies',
          level: 3,
          body: [{ type: 'text', value: 'Remember preferences like language or course progress.' }],
        },
        {
          navId: 'marketing-cookies',
          navLabel: 'Marketing / Communication',
          title: 'd) Marketing / Communication Cookies & Partners',
          level: 3,
          body: [
            { type: 'text', value: 'Used to send emails, SMS, WhatsApp, push notifications.' },
            richContent(
              '<strong class="text-white">Current provider:</strong> Netcore; partners may change at our discretion.',
            ),
          ],
        },
        {
          navId: 'push-notifications',
          navLabel: 'Push Notifications',
          title: 'e) Managing Push Notifications',
          level: 3,
          body: [
            { type: 'text', value: 'Can be disabled via your device settings (iOS/Android).' },
            { type: 'text', value: 'Disabling may limit certain alerts or updates.' },
          ],
        },
        {
          navId: 'managing-cookies',
          navLabel: 'Managing Cookies',
          title: 'f) Managing Cookies',
          level: 3,
          body: [
            {
              type: 'text',
              value: 'Non-essential cookies can be disabled via browser/device settings.',
            },
            { type: 'text', value: 'Some Service features may not work if cookies are blocked.' },
          ],
        },
      ],
    },
    {
      navId: 'analytics-advertising',
      navLabel: 'Analytics & Advertising',
      title: '7. Online Analytics & Advertising',
      level: 2,
      body: [
        {
          type: 'text',
          value:
            'Use of third-party analytics (Google Analytics, Firebase) to monitor usage, audit, research, or prevent fraud.',
        },
        {
          type: 'text',
          value:
            'Online advertising may be delivered by third parties based on demographics, interests, or previous activity.',
        },
        { type: 'text', value: 'Users may opt out of targeted advertising via:' },
        {
          type: 'list',
          items: [
            'Network Advertising Initiative',
            'Digital Advertising Alliance',
            'Your Online Choices',
            'Google Ads Settings',
          ],
        },
      ],
    },
    {
      navId: 'disclosure',
      navLabel: 'Disclosure',
      title: '8. Disclosure of Information',
      level: 2,
      body: [],
      sections: [
        {
          navId: 'affiliates',
          navLabel: 'Affiliates & Subsidiaries',
          title: 'a) Affiliates & Subsidiaries',
          level: 3,
          body: [
            {
              type: 'text',
              value:
                'Shared within the Miles Masterclass Inc. family for consistent service delivery.',
            },
          ],
        },
        {
          navId: 'service-providers',
          navLabel: 'Service Providers',
          title: 'b) Service Providers',
          level: 3,
          body: [
            {
              type: 'text',
              value:
                'Access provided only for performing services (billing, marketing, analytics, AI, security, legal, etc.).',
            },
          ],
        },
        {
          navId: 'protection',
          navLabel: 'Protection of Rights',
          title: 'c) Protection of Miles Masterclass & Others',
          level: 3,
          body: [
            {
              type: 'text',
              value:
                'Disclosure permitted to comply with law, enforce Terms, protect rights, or prevent fraud.',
            },
          ],
        },
        {
          navId: 'business-transfers',
          navLabel: 'Business Transfers',
          title: 'd) Business Transfers',
          level: 3,
          body: [
            {
              type: 'text',
              value:
                'User information may be transferred in mergers, acquisitions, or asset sales.',
            },
          ],
        },
        {
          navId: 'public-forums',
          navLabel: 'Public Forums',
          title: 'e) Public Forums',
          level: 3,
          body: [
            {
              type: 'text',
              value: 'Content posted publicly may be visible to others and used for marketing.',
            },
          ],
        },
        {
          navId: 'aggregate-info',
          navLabel: 'Aggregate / De-identified',
          title: 'f) Aggregate / De-identified Information',
          level: 3,
          body: [
            {
              type: 'text',
              value: 'May be disclosed freely without identifying individual users.',
            },
          ],
        },
      ],
    },
    {
      navId: 'retention',
      navLabel: 'Retention',
      title: '9. Retention of Your Information',
      level: 2,
      body: [
        {
          type: 'text',
          value: 'Retained only as long as necessary for Service provision or legal compliance.',
        },
        richContent(
          'Users may request account or data deletion: <a href="mailto:support@milesmasterclass.com" class="underline text-accent hover:text-accent/80">support@milesmasterclass.com</a>.',
        ),
      ],
    },
    {
      navId: 'security',
      navLabel: 'Security',
      title: '10. Security',
      level: 2,
      body: [
        { type: 'text', value: 'Reasonable technical and organizational safeguards implemented.' },
        {
          type: 'text',
          value:
            'Internet/email transmission is never fully secure; share personal data with caution.',
        },
      ],
    },
    {
      navId: 'mobile-services',
      navLabel: 'Mobile Services',
      title: '11. Mobile Services',
      level: 2,
      body: [
        { type: 'text', value: 'Standard carrier fees may apply.' },
        {
          type: 'text',
          value:
            'Consent to receive SMS, calls, or push notifications from Miles Masterclass or service providers.',
        },
        {
          type: 'text',
          value:
            'Users must update mobile numbers to ensure messages are received by the correct person.',
        },
      ],
    },
    {
      navId: 'sms-messaging',
      navLabel: 'SMS/Text Messaging',
      title: '12. SMS/Text Messaging',
      level: 2,
      body: [
        {
          type: 'text',
          value:
            'When you provide your mobile number, you may receive automated text messages from Miles Masterclass, including one-time passcodes (OTPs) and account or service notifications. Message frequency varies. Message and data rates may apply.',
        },
        {
          type: 'text',
          value:
            'You can opt out of text messages at any time by replying STOP; reply HELP for assistance. Opting out will not affect your ability to use other Miles Masterclass services, though some account verification steps may require an alternative method.',
        },
        {
          type: 'text',
          value:
            'We do not sell or share your mobile number or SMS consent with third parties or affiliates for their own marketing purposes. We share your mobile number only with our messaging service provider(s) for the sole purpose of delivering the messages you have requested.',
        },
        richContent(
          'For questions about our messaging practices, contact <a href="mailto:support@milesmasterclass.com" class="underline text-accent hover:text-accent/80">support@milesmasterclass.com</a>.',
        ),
      ],
    },
    {
      navId: 'third-party',
      navLabel: 'Third-Party Links',
      title: '13. Third-Party Links & Features',
      level: 2,
      body: [
        {
          type: 'text',
          value:
            'Services may include links to third-party websites or plug-ins (e.g., social media).',
        },
        {
          type: 'text',
          value:
            'Data collection by third parties governed by their privacy policies, not this Privacy Policy.',
        },
      ],
    },
    {
      navId: 'children',
      navLabel: 'Children',
      title: '14. Children',
      level: 2,
      body: [
        {
          type: 'text',
          value:
            'Services not directed at children under 13; we do not knowingly collect their data.',
        },
      ],
    },
    {
      navId: 'changes',
      navLabel: 'Changes',
      title: '15. Changes to This Privacy Policy',
      level: 2,
      body: [
        {
          type: 'text',
          value: 'Policy may be updated; latest version posted on milesmasterclass.com.',
        },
      ],
    },
    {
      navId: 'contact',
      navLabel: 'Contact',
      title: '16. Contact',
      level: 2,
      body: [
        richContent(
          'For privacy inquiries or data deletion: <a href="mailto:support@milesmasterclass.com" class="underline text-accent hover:text-accent/80">support@milesmasterclass.com</a>',
        ),
      ],
    },
  ],
};

/**
 * Per-locale overrides. Empty today — add a `${country}:${profession}` key
 * (lowercased) when a market needs different copy.
 */
const LOCALE_OVERRIDES: Partial<Record<LocaleKey, LegalDoc>> = {
  // 'in:accounting': IN_ACCOUNTING_PRIVACY_POLICY,
};

/** Returns the right Privacy Policy doc for the active locale. */
export const resolvePrivacyPolicy = (country: CountryCode, profession: ProfessionType): LegalDoc =>
  resolveByLocale(LOCALE_OVERRIDES, DEFAULT_PRIVACY_POLICY, country, profession);
