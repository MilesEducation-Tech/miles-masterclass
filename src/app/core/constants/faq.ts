import { FAQ } from '../models/faq.model';
import { CountryCode, ProfessionType } from '../models/route-params.model';
import { LocaleKey, resolveByLocale } from '@shared/utils/locale-resolver';

/**
 * FAQ data. Pages should consume `resolveFaqData(country, profession)` so
 * future per-market FAQ variations slot in without page-level changes.
 * Today the resolver always returns `FAQ_DATA` since no overrides exist;
 * the bare const remains exported for any module that needs the full
 * canonical list (e.g. SEO previews, sitemap generation).
 */
export const FAQ_DATA: FAQ[] = [
  {
    id: 1,
    question: 'General',
    content: [],
    children: [
      {
        id: 101,
        question: 'What is Continuing Professional Education (CPE)?',
        content: [
          {
            type: 'text',
            value:
              'Continuing Professional Education (CPE) is a requirement for Certified Public Accountants (CPAs) and Certified Management Accountants (CMAs) and other professionals, one that is designed to help maintain their competency and skill sets as providers of professional services. As part of ongoing requirements to maintain the CPA or designation, CPAs and CMAs must meet all the regulations set out by the state they are registered in.',
          },
          {
            type: 'note',
            value:
              'Click here to view the CPE policy for CPAs: https://nasba.org/licensure/maintainingalicense/',
            variant: 'info',
          },
          {
            type: 'note',
            value:
              'Click here to view the CPE policy for CMAs: https://www.imanet.org/en/IMA-Certifications/CMA-Certification/Maintain',
            variant: 'info',
          },
        ],
      },
      {
        id: 102,
        question:
          'Is Miles registered with NASBA? Is Miles authorized to issue NASBA approved CPE certificates?',
        content: [
          {
            type: 'subtext',
            value: 'Sponsor Id#: 149174',
          },
          {
            type: 'text',
            value:
              'Miles Masterclass Inc. is registered with the National Association of State Boards of Accountancy (NASBA) as a sponsor of continuing professional education on the National Registry of CPE Sponsors. State boards of accountancy have final authority on the acceptance of individual courses for CPE credit. Complaints regarding registered sponsors may be submitted to the National Registry of CPE Sponsors through its website: www.nasbaregistry.org',
          },
        ],
      },
      {
        id: 103,
        question: 'Field of Study',
        content: [
          {
            type: 'text',
            value:
              'We are licensed by NASBA and follow their guidelines for the subject area (field of study).',
          },
          {
            type: 'note',
            value:
              'See this document for more details from NASBA: https://www.nasbaregistry.org/registry-forms--policies/fields-of-study',
            variant: 'info',
          },
        ],
      },
      {
        id: 104,
        question: 'State Requirements',
        content: [
          {
            type: 'text',
            value:
              'Certified Public Accountants (CPAs) must adhere to the continuing education requirements set forth by the State Board of Accountancy of the state(s) where their CPA license is held. The requirements for continuing professional education vary from state to state. The American Institute of CPAs (AICPA) requires certain CPE for maintaining membership.',
          },
          {
            type: 'note',
            value:
              'View those further specifications here: https://www.nasbaregistry.org/cpe-requirements',
            variant: 'info',
          },
        ],
      },
      {
        id: 105,
        question: 'How will I know if the Webinar/Master Class is technical or non-technical?',
        content: [
          {
            type: 'text',
            value:
              'We are licensed by NASBA and follow their guidelines for the subject area (field of study).',
          },
          {
            type: 'note',
            value:
              'See this document for more details from NASBA: https://www.nasbaregistry.org/registry-forms--policies/fields-of-study',
            variant: 'info',
          },
        ],
      },
      {
        id: 106,
        question: 'Name on CPE Certificate',
        content: [
          {
            type: 'text',
            value: 'The name printed on the CPE certificate will be the name on your Profile.',
          },
          {
            type: 'note',
            value:
              'Note that the name on the CPE Certificate needs to be as per your CPA/CMA certificate for the CPE Certificate to be accepted by State Boards of Accountancy (CPA) and IMA (CMA).',
            variant: 'warning',
          },
          {
            type: 'description',
            value: 'To edit your name follow the below path:',
          },
          {
            type: 'text',
            value:
              'Login > Click on Profile on the top LHC > Make the desired changes and click on Update',
          },
        ],
      },
      {
        id: 107,
        question: 'How is CPE delivered on Miles Masterclass?',
        content: [
          {
            type: 'heading',
            value: '01. Master Class (Hollywood-Style Video Lessons)',
            level: 3,
          },
          {
            type: 'text',
            value:
              'Binge-worthy learning for finance professionals. Watch scripted, story-driven episodes that make accounting and finance come alive — while earning your annual CPE credits.',
          },
          {
            type: 'subtext',
            value: 'Delivery Mode: QAS Self-Study',
          },
          {
            type: 'heading',
            value: '02. Podcasts',
            level: 3,
          },
          {
            type: 'text',
            value:
              'Conversations that inspire. Tune in to interviews with top leaders and innovators sharing real-world insights — and earn QAS Self-Study Credits as you listen.',
          },
          {
            type: 'subtext',
            value: 'Delivery Mode: QAS Self-Study',
          },
          {
            type: 'heading',
            value: '03. Micro Learning (Reels for Accountants)',
            level: 3,
          },
          {
            type: 'text',
            value:
              'Short. Sharp. Skill-packed. Our Nano Learning videos deliver bite-sized lessons you can watch anytime, anywhere — perfect for busy professionals on the go.',
          },
          {
            type: 'subtext',
            value: 'Delivery Mode: QAS Self-Study',
          },
          {
            type: 'heading',
            value: '04. Virtual Premieres',
            level: 3,
          },
          {
            type: 'text',
            value:
              'Be part of the first look. Join exclusive launch events for new Master Classes and earn CPE credits live — no dress code required.',
          },
          {
            type: 'subtext',
            value: 'Delivery Mode: Group Internet Based',
          },
        ],
      },
      {
        id: 108,
        question: 'What are the NASBA-approved delivery methods on Miles Masterclass?',
        content: [
          {
            type: 'text',
            value:
              'Miles Masterclass offers two NASBA-approved learning modes for earning CPE credits:',
          },
          {
            type: 'heading',
            value: 'Group Internet-Based (GIB)',
            level: 3,
          },
          {
            type: 'text',
            value:
              'Live, interactive sessions and virtual premieres conducted online, where participants engage in real time and earn credits based on active participation.',
          },
          {
            type: 'heading',
            value: 'QAS Self Study',
            level: 3,
          },
          {
            type: 'text',
            value:
              'On-demand courses, podcasts, and nano learning modules that allow learners to study at their own pace and earn credits after successful completion and assessment.',
          },
        ],
      },
    ],
  },
  {
    id: 2,
    question: 'Credits & Reporting',
    content: [],
    children: [
      {
        id: 201,
        question:
          'How are CPE Credits calculated for a Group Internet Based (aka Premieres) session?',
        content: [
          {
            type: 'text',
            value:
              'Sessions are measured by actual program length, with one 50-minute period equal to one CPE credit.',
          },
          {
            type: 'table',
            headers: [
              'Duration (excluding admin activities like Session Rules, Presenter Introduction, Q&A)',
              'Number of Polling Questions to be Asked',
              'Number of Polling Questions to be Answered to be Eligible for CPE Certificate',
              'CPE Credits (50 minutes = 1 CPE Credit)',
            ],
            rows: [
              ['60 minutes', '4', '3', '1.2'],
              ['90 minutes', '7', '6', '1.8'],
              ['120 minutes', '8', '7', '2.4'],
              ['180 minutes', '12', '11', '3.6'],
            ],
          },
        ],
      },
      {
        id: 202,
        question: 'How do I earn CPE credit?',
        content: [
          {
            type: 'heading',
            value: 'Delivery Method - Group Internet Based (aka Webinar)',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'To earn credit for a Webinar (Group Internet-Based session), learners must remain logged into the session and answer the required number of poll questions to mark attendance.',
              'Polling questions will be posted at regular intervals throughout the Webinar session.',
              'Learners are required to answer "N-1" number of polling questions to be marked "Present" for the session (For example, if there are 5 polling questions, then participants are required to answer at least 4 polling questions to be marked present).',
              'Note that the purpose of the polling questions is to monitor active participation and there is no penalty for submitting the wrong answer.',
              'Learners will be informed regarding the number of polling questions to be answered at the start of the session.',
            ],
          },
          {
            type: 'heading',
            value: 'Delivery Method - QAS Self-Study (aka Master Class, Podcast & Micro Learning)',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'To earn CPE credits for a Master Class, learners are required to complete all course content (i.e watch the recorded videos and answer the chapter quiz) and pass the exam with a minimum score of 70% within 1 year of enrolling for the course.',
            ],
          },
        ],
      },
      {
        id: 203,
        question: 'How do I get the CPE Certificate?',
        content: [
          {
            type: 'heading',
            value: 'Delivery Method - Group Internet Based (aka Webinar)',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'Learners need to submit the evaluation feedback from the "Premieres Attended" section for the session they attended.',
              'Note that the Evaluation Feedback form will be pre-populated with the "Name" and "Email-ID" used at the time of registration.',
              'Once the form is filled and submitted, learners can download their CPE Certificate (in case the attendance status is "Present") under the "Premieres Attended" or from the CPE tracker "Completed" section.',
            ],
          },
          {
            type: 'heading',
            value: 'Delivery Method - QAS Self Study (aka Master Class, Podcast & Micro Learning)',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'Learners who have scored a minimum of 70% in the exam, will have the option to fill the evaluation feedback for the course after review of the exam results.',
              'Once the evaluation feedback is submitted learners can download their CPE Certificate and Miles Learning Certificate under the Recently Watched Section in the Master Class Tab.',
              'Note that the Evaluation Feedback form will be pre-populated with the "Name" and "Email-ID" used at the time of registration.',
              'Once the form is filled and submitted, learners can download their CPE Certificate under the "Courses You\'ve Mastered" section or from the CPE tracker "Completed" section.',
            ],
          },
        ],
      },
      {
        id: 204,
        question: 'Why did I not earn the CPE credit?',
        content: [
          {
            type: 'heading',
            value: 'Delivery Method - Group Internet Based (aka Premieres)',
            level: 4,
          },
          {
            type: 'description',
            value: 'Please consider the following:',
          },
          {
            type: 'list',
            ordered: true,
            items: [
              'Has it been at least 48 hours since the Webinar ended?',
              'Did you answer the required number of polling questions?',
              'Did you complete and submit the session evaluation feedback?',
              'Did you login to the premiere using a different name or email address than what is listed in your profile?',
              'Did you have an active CPE subscription at the time of attending the Webinar or purchased the course certificate?',
            ],
          },
          {
            type: 'text',
            value:
              'If the answer to either of the questions is "NO", you will not receive the NASBA approved CPE certificate.',
          },
          {
            type: 'note',
            value:
              "If you believe you should have been issued a certificate or may have logged into the Webinar with a different name or email address than what's listed in your profile, please email support@milesmasterclass.com and include the possible alternative names and email address that were used (for example: Varun Jain vs. Varun Jain II or varunjain@mileseducation.com vs varunjain2@mileseducation.com) along with the name of the session.",
            variant: 'info',
          },
          {
            type: 'heading',
            value: 'Delivery Method - QAS Self-Study (aka Master Class, Podcast & Micro Learning)',
            level: 4,
          },
          {
            type: 'description',
            value: 'Please consider the following:',
          },
          {
            type: 'list',
            ordered: true,
            items: [
              'Did you complete the course in CPE Mode?',
              'Did you score 70% or more in the exam?',
              'Did you pass the exam with a score of 70% within 1 year of enrolling/launching the course?',
              'Did you complete and submit the session evaluation feedback after passing the exam?',
              'Has it been 48 hours since the feedback was submitted?',
            ],
          },
          {
            type: 'note',
            value:
              'If all of the above are satisfied, kindly drop an email to support@milesmasterclass.com mentioning the name of the Master Class.',
            variant: 'info',
          },
        ],
      },
      {
        id: 205,
        question: 'Registered but did not attend the premiere',
        content: [
          {
            type: 'heading',
            value: 'Delivery Method - Group Internet Based (aka Premieres)',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'If you registered for a Webinar (Group Internet-Based) session but didn\'t attend, you\'ll be marked as "Absent."',
              'You can easily find all the sessions you missed under the "Premieres You\'ve Missed" section in the Webinar Tab.',
            ],
          },
          {
            type: 'heading',
            value: 'Delivery Method - QAS Self Study (aka Master Class, Podcast & Micro Learning)',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'If the learner has not passed the exam with a score of 70% or above within one year of enrolling/launching the Master Class course, the course progress will be wiped out.',
              'The learner will be required to redo the course in CPE Mode as per NASBA guidelines.',
            ],
          },
        ],
      },
      {
        id: 206,
        question: 'Locating Course Evaluation Feedback',
        content: [
          {
            type: 'description',
            value:
              'Follow this path to access and submit the Course Evaluation Feedback (where applicable):',
          },
          {
            type: 'heading',
            value: 'Delivery Method - Group Internet Based (aka Premieres)',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'Login > Click on Premieres > Scroll down to the "Premieres Attended" section',
              'Locate the premiere(s) in question > Hover on the card and click on the "Feedback" button.',
            ],
          },
          {
            type: 'heading',
            value: 'Delivery Method - QAS Self Study (aka Master Class, Podcast & Micro Learning)',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'Login > Click on Master Class > Scroll down to the "Courses You\'ve Mastered" section',
              'Locate the Master Class(es) in question > Hover on the card and click on the "Feedback" button.',
            ],
          },
        ],
      },
      {
        id: 207,
        question: 'Locating CPE Certificates',
        content: [
          {
            type: 'description',
            value: 'Follow this path to download the CPE Certificates (where applicable):',
          },
          {
            type: 'heading',
            value: 'Delivery Method - Group Internet Based (aka Premieres)',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'Login > Click on Premieres > Scroll down to the "Premieres Attended" section',
              'Locate the premiere(s) in question > Hover on the card and click on the "Download Certificate" button.',
            ],
          },
          {
            type: 'note',
            value:
              'PLEASE NOTE: You will need to complete the "Course Evaluation Feedback" before the certificate will be processed.',
            variant: 'warning',
          },
          {
            type: 'heading',
            value: 'Delivery Method - QAS Self Study (aka Master Class, Podcast & Micro Learning)',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'Login > Click on Master Class > Scroll down to the "Courses You\'ve Mastered" section',
              'Locate the Master Class(es) in question > Hover on the card and click on the "Download Certificate" button.',
            ],
          },
          {
            type: 'note',
            value:
              'PLEASE NOTE: You will need to complete the "Course Evaluation Feedback" before the certificate will be processed.',
            variant: 'warning',
          },
        ],
      },
    ],
  },
  {
    id: 3,
    question: 'Payment, Cancellation & Refund',
    content: [],
    children: [
      {
        id: 301,
        question: 'Is There a Fee to Register or Attend a Premier?',
        content: [
          {
            type: 'text',
            value:
              'Nope! Premieres are absolutely free — no hidden costs, no strings attached. Just sign up to register and attend.',
          },
          {
            type: 'text',
            value:
              "When you sign up and subscribe, you'll gain access to Miles Masterclass and its full library of AI-powered learning content.",
          },
          {
            type: 'text',
            value:
              'Please note: To download the CPE certificate (provided you meet the eligibility criteria** - see the Credits & Reporting section), you must have an active subscription.',
          },
          {
            type: 'note',
            value:
              '*CPE Certificates, CPE tracking, and LinkedIn-ready digital badges are exclusive to subscribers.',
            variant: 'info',
          },
          {
            type: 'note',
            value:
              '**For more details on earning CPE credits, check out the Credits and Reporting section ("How do I earn CPE credits?").',
            variant: 'info',
          },
          {
            type: 'note',
            value:
              'Please Note: Miles Masterclass Inc. reserves the right to modify its payment policy at any time. Any changes will be communicated to registered members at least 7 days in advance before taking effect.',
            variant: 'warning',
          },
        ],
      },
      {
        id: 302,
        question: 'Is There a Fee to Access Master Class Video/Course Content?',
        content: [
          {
            type: 'text',
            value:
              'You can watch the course trailer and sample video at no cost - no signup required.',
          },
          {
            type: 'text',
            value:
              'To unlock the full course content, simply create your Miles Masterclass account, subscribe, and start learning.',
          },
          {
            type: 'description',
            value: 'To earn a NASBA-approved CPE Certificate, you must:',
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'Access the course in CPE Mode',
              'Meet the eligibility criteria** - including scoring at least 70% on assessments within one year of enrolling or launching the course',
              'Have an active subscription *',
            ],
          },
          {
            type: 'note',
            value:
              '*CPE Certificates, the CPE Tracker, and LinkedIn-ready Digital Badges are exclusive to subscribers.',
            variant: 'info',
          },
          {
            type: 'note',
            value:
              '**Check out the Credits & Reporting section ("How do I earn CPE credits?") for full details.',
            variant: 'info',
          },
          {
            type: 'note',
            value:
              'Please Note: Miles Masterclass Inc. reserves the right to modify its payment policy at any time. Any changes will be communicated to registered members at least 7 days in advance before taking effect.',
            variant: 'warning',
          },
        ],
      },
      {
        id: 303,
        question: 'Do I Have to Pay to Download the CPE Certificate?',
        content: [
          {
            type: 'heading',
            value: 'Delivery Method - Group Internet Based (aka Premiers/Webinars)',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'Registering for and attending a Webinar is completely free - no payment or subscription required to participate.',
              'However, to download the CPE Certificate, you must have an active subscription and meet the eligibility criteria* (subject to conditions).',
            ],
          },
          {
            type: 'note',
            value:
              '*For more details on earning CPE credits, check out the Credits and Reporting section ("How do I earn CPE credits?").',
            variant: 'info',
          },
          {
            type: 'heading',
            value: 'Delivery Method - QAS Self Study (aka Masterclass)',
            level: 4,
          },
          {
            type: 'text',
            value:
              'To download the CPE certificate for a launched and completed Masterclass course in CPE Mode, you must have an active subscription and meet the eligibility criteria*.',
          },
          {
            type: 'note',
            value:
              '*For more details on earning CPE credits, check out the Credits and Reporting section ("How do I earn CPE credits?").',
            variant: 'info',
          },
          {
            type: 'note',
            value:
              'Please Note: Miles Masterclass Inc. reserves the right to modify its payment policy at any time. Any changes will be communicated to registered members at least 7 days in advance before taking effect.',
            variant: 'warning',
          },
        ],
      },
      {
        id: 304,
        question: 'Are payments made on a secure connection?',
        content: [
          {
            type: 'heading',
            value: 'For purchases made on the website',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'We use a tool that processes payments called Stripe (https://stripe.com/). Stripe uses an HTTPS protocol to secure all online transactions.',
              "We don't directly store any of your payment information.",
              'All transactional information is processed by Stripe, and a receipt from Stripe is used to confirm your payment.',
            ],
          },
          {
            type: 'heading',
            value: 'For purchases made on App Store (Apple)',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'Apple ID Authentication – Users must sign in with their Apple ID and authenticate using Face ID, Touch ID, or a password.',
              'Secure Payment Processing – Apple processes all transactions using encrypted payment methods, including credit/debit cards, Apple Pay, and PayPal.',
              "Receipt Validation – Apps must validate purchase receipts with Apple's servers to confirm authenticity and prevent fake purchases.",
            ],
          },
          {
            type: 'heading',
            value: 'For purchases made on Play Store (Android)',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'Google Account Authentication – Users must log in with their Google account, with optional biometric authentication (fingerprint or face unlock).',
              "Google Play Billing System – All transactions go through Google's secure payment system, encrypting payment details.",
              'Play Protect & Fraud Detection – Google Play Protect continuously scans for suspicious activity and unauthorized transactions.',
            ],
          },
        ],
      },
      {
        id: 305,
        question: 'Where Can I Download My Order Confirmation?',
        content: [
          {
            type: 'list',
            ordered: false,
            items: [
              'You can download your order confirmation from the Order History section.',
              'Additionally, you should have received an email from Stripe upon successfully placing your order.',
              "If you can't find the email, please check your spam or promotions folder.",
            ],
          },
        ],
      },
      {
        id: 306,
        question: 'I Have an Active Subscription. Do I Still Need to Pay for the Certificate?',
        content: [
          {
            type: 'description',
            value: 'It depends:',
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'If the course is not covered under your subscription, you will need to pay for the certificate.',
              "If your subscription has a course limit and you've reached the maximum number of courses covered, you will need to pay for additional courses.",
              "Check your subscription details to see what's included!",
            ],
          },
        ],
      },
      {
        id: 307,
        question: 'Subscription Policy',
        content: [
          {
            type: 'heading',
            value: 'Pro Plan',
            level: 3,
          },
          {
            type: 'subtext',
            value: 'What You Get',
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'Full access to 22+ categories: Master Classes, Podcast, and Micro-Learning Reels.',
              'Watch on Desktop and Mobile Devices',
              'New Courses Added Every Month',
              'Pay Securely Using Major Credit Cards',
              'NASBA-Approved CPE Certificates*',
              'Credly Digital Badge* to Share on LinkedIn',
              'Certified AI Ready Accountant Digital Badge*',
              'Track compliance with CPE Tracker',
            ],
          },
          {
            type: 'note',
            value:
              '*Refer to the Credits & Reporting and CAIRA sections in the FAQs to learn more.',
            variant: 'info',
          },
          {
            type: 'heading',
            value: 'Enterprise Plan - Custom Pricing',
            level: 3,
          },
          {
            type: 'subtext',
            value: 'What You Get',
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'All benefits of the Pro plan',
              'Dedicated customer success manager',
              'Organizational membership management',
              'Analytics and adoption reports',
            ],
          },
          {
            type: 'note',
            value:
              'Please Note: Miles Masterclass Inc. reserves the right to modify its payment policy at any time. Any changes will be communicated to registered members at least 7 days in advance before taking effect.',
            variant: 'warning',
          },
        ],
      },
      {
        id: 308,
        question: 'How do I cancel my subscription?',
        content: [
          {
            type: 'heading',
            value: 'For Website Subscriptions',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'You can only cancel the auto-renewal of your subscription. Your subscription will remain active until the end of the current billing period.',
              'To cancel auto-renewal, follow these steps on our website: Login > Plan Section > Click on "Cancel Renewal"',
              'This will disable auto-pay, ensuring your subscription does not renew at the end of the billing cycle.',
              'Refunds will not be provided for partial or unused subscription periods.',
            ],
          },
          {
            type: 'heading',
            value: 'For iOS (App Store) Subscriptions',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'You can only cancel the auto-renewal of your subscription. Your subscription will remain active until the end of the current billing period.',
              'This will stop auto-renewal, and your subscription will not renew at the end of the billing cycle.',
              'Refunds will not be provided for partial or unused subscription periods.',
            ],
          },
          {
            type: 'description',
            value: 'To cancel auto-renewal on iOS, follow these steps:',
          },
          {
            type: 'list',
            ordered: true,
            items: [
              'Open Settings on your iPhone or iPad.',
              'Tap your Apple ID (your name at the top).',
              'Select Subscriptions.',
              'Find and tap on your Miles Masterclass subscription.',
              'Tap Cancel Subscription and confirm.',
            ],
          },
          {
            type: 'heading',
            value: 'For Android (Google Play) Subscriptions',
            level: 4,
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'You can only cancel the auto-renewal of your subscription. Your subscription will remain active until the end of the current billing period.',
              'This will stop auto-renewal, and your subscription will not renew at the end of the billing cycle.',
              'Refunds will not be provided for partial or unused subscription periods.',
            ],
          },
          {
            type: 'description',
            value: 'To cancel auto-renewal on Android, follow these steps:',
          },
          {
            type: 'list',
            ordered: true,
            items: [
              'Open the Google Play Store on your Android device.',
              'Tap your profile icon (top-right corner).',
              'Select Payments & Subscriptions > Subscriptions.',
              'Find and tap on your Miles Masterclass subscription.',
              'Tap Cancel Subscription and confirm.',
            ],
          },
        ],
      },
      {
        id: 309,
        question: 'Subscription Renewal Policy',
        content: [
          {
            type: 'list',
            ordered: false,
            items: [
              'You can renew your subscription before it expires by: clicking the "Reactivate Renewal" button from the Plan Page, or navigating to Order History > current subscription > Actions > Renew.',
            ],
          },
        ],
      },
      {
        id: 310,
        question: 'Refund Policy',
        content: [
          {
            type: 'list',
            ordered: false,
            items: [
              'All online purchases are final, and no refunds will be issued under any circumstances.',
              'Once a payment is successfully processed, it is non-refundable and non-transferable.',
              'We encourage users to carefully review course details, terms, and conditions before making a purchase.',
              'If you have any questions or need clarification, please contact our support team before completing your transaction.',
              'Refunds will not be provided for partial or unused subscription periods.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 4,
    question: 'Technical Support',
    content: [],
    children: [
      {
        id: 401,
        question: 'Not able to Signup/Login',
        content: [
          {
            type: 'text',
            value: 'Drop an email to support@milesmasterclass.com',
          },
        ],
      },
      {
        id: 402,
        question:
          'How do I change my account details such as my name, email address, phone number, etc?',
        content: [
          {
            type: 'text',
            value: 'Log in and click on Edit Profile to change your Name and Location.',
          },
          {
            type: 'note',
            value: 'Note that Email ID and Mobile Number cannot be edited.',
            variant: 'warning',
          },
          {
            type: 'note',
            value:
              'Note that the Name on your profile will be the name that is printed on the CPE Certificate. Your Name needs to be as per your CPA/CMA certificate for the CPE Certificate to be accepted by State Boards of Accountancy (CPA) and IMA (CMA).',
            variant: 'warning',
          },
        ],
      },
      {
        id: 403,
        question: 'Compliant Policy',
        content: [
          {
            type: 'text',
            value:
              'Miles Masterclass Inc. ensures that all its programs provide updated content taking into consideration the latest amendments and is committed to providing the most beneficial and satisfactory experience to all its course users.',
          },
          {
            type: 'text',
            value:
              'In the event any participant is not completely satisfied with any Group Internet-based courses or of the QAS Self-Study courses and wishes to file a complaint, please contact support@milesmasterclass.com within 10 business days of the event. Miles Masterclass Inc. shall ensure satisfactory resolution of each and every complaint filed.',
          },
        ],
      },
      {
        id: 404,
        question: 'Other queries?',
        content: [
          {
            type: 'text',
            value: 'For any other queries drop an email to support@milesmasterclass.com',
          },
        ],
      },
    ],
  },
  {
    id: 5,
    question: 'CAIRA (Certified AI Ready Accountant)',
    content: [],
    children: [
      {
        id: 501,
        question: 'What is CAIRA Level 1?',
        content: [
          {
            type: 'text',
            value:
              "CAIRA (Certified AI Ready Accountant – Level 1) is a digital certification by Miles Masterclass, co-created with global accounting and AI leaders. It's designed to help accountants build future-ready, AI-powered skills and earn a Credly-verified digital badge upon completion.",
          },
        ],
      },
      {
        id: 502,
        question: 'Who is CAIRA for?',
        content: [
          {
            type: 'text',
            value:
              "CAIRA is designed for accounting and finance professionals who want to stay ahead in the AI era — whether you're advancing your career, pivoting to a tech-driven role, or gaining in-demand skills to lead the transformation.",
          },
        ],
      },
      {
        id: 503,
        question: "What's included in CAIRA Level 1?",
        content: [
          {
            type: 'list',
            ordered: false,
            items: [
              '30 CPE hours of expert-led learning content',
              'Lessons, quizzes, and activities designed for practical application',
              'Insights from global leaders in AI and accounting',
              'Auto-tracked CPE credits',
              'A Credly digital badge you can showcase on LinkedIn',
            ],
          },
        ],
      },
      {
        id: 504,
        question: 'How long does it take to complete?',
        content: [
          {
            type: 'text',
            value:
              "You can complete CAIRA Level 1 in about 30 hours — or learn at your own pace. You'll have continued access to revisit content at any time during your subscription.",
          },
        ],
      },
      {
        id: 505,
        question: 'Is CAIRA included in my Miles Masterclass subscription?',
        content: [
          {
            type: 'text',
            value:
              'Yes! CAIRA Level 1 is included as part of your Miles Masterclass subscription — giving you full access to the certification content, CPE tracking, and your Credly-verified badge at no additional cost.',
          },
          {
            type: 'note',
            value:
              'For more details regarding the Subscription Policy, check out the Payments, Cancellations & Refund section ("Subscription Policy")',
            variant: 'info',
          },
        ],
      },
      {
        id: 506,
        question: 'How much does CAIRA Level 1 cost?',
        content: [
          {
            type: 'text',
            value:
              'CAIRA Level 1 comes free with your active Miles Masterclass subscription. Simply subscribe to Miles Masterclass to unlock access and start your certification journey.',
          },
          {
            type: 'note',
            value:
              'For more details regarding the Subscription Policy, check out the Payments, Cancellations & Refund section ("Subscription Policy")',
            variant: 'info',
          },
        ],
      },
      {
        id: 507,
        question: 'Can I share my CAIRA credential?',
        content: [
          {
            type: 'text',
            value:
              'Absolutely. Your CAIRA Level 1 credential is issued via Credly — a globally recognized digital badge platform — and can be showcased on LinkedIn, your résumé, or other professional platforms.',
          },
        ],
      },
      {
        id: 508,
        question: 'Can I access CAIRA on the Miles Masterclass App?',
        content: [
          {
            type: 'text',
            value:
              'Yes! You can learn, track your progress, earn CPE credits, and claim your CAIRA Level 1 Credly badge — all directly through the Miles Masterclass App or website.',
          },
        ],
      },
    ],
  },
];
export const FAQ_DATA2: FAQ[] = [
  {
    id: 1,
    question: 'General',
    content: [
      {
        type: 'heading',
        value: 'What is Continuing Professional Education (CPE)?',
        level: 4,
      },
      {
        type: 'text',
        value:
          'Continuing Professional Education (CPE) is a requirement for Certified Public Accountants (CPAs) and Certified Management Accountants (CMAs) and other professionals, one that is designed to help maintain their competency and skill sets as providers of professional services. As part of ongoing requirements to maintain the CPA or designation, CPAs and CMAs must meet all the regulations set out by the state they are registered in.',
      },
      {
        type: 'text',
        value:
          'Click here to view the CPE policy for CPAs. Click here to view the CPE policy for CMAs.',
      },
      {
        type: 'heading',
        value:
          'Is Miles registered with NASBA? Is Miles authorized to issue NASBA approved CPE certificates?',
        level: 4,
      },
      {
        type: 'note',
        value: 'Sponsor Id#: 149174',
        variant: 'info',
      },
      {
        type: 'text',
        value:
          'Miles Masterclass Inc. is registered with the National Association of State Boards of Accountancy (NASBA) as a sponsor of continuing professional education on the National Registry of CPE Sponsors. State boards of accountancy have final authority on the acceptance of individual courses for CPE credit. Complaints regarding registered sponsors may be submitted to the National Registry of CPE Sponsors through its website: www.nasbaregistry.org',
      },
      {
        type: 'heading',
        value: 'Field of Study',
        level: 4,
      },
      {
        type: 'text',
        value:
          'We are licensed by NASBA and follow their guidelines for the subject area (field of study). See this document for more details from NASBA.',
      },
      {
        type: 'heading',
        value: 'State Requirements',
        level: 4,
      },
      {
        type: 'text',
        value:
          'Certified Public Accountants (CPAs) must adhere to the continuing education requirements set forth by the State Board of Accountancy of the state(s) where their CPA license is held. The requirements for continuing professional education vary from state to state. The American Institute of CPAs (AICPA) requires certain CPE for maintaining membership.',
      },
      {
        type: 'text',
        value: 'View those further specifications here.',
      },
      {
        type: 'heading',
        value: 'How will I know if the Webinar/Master Class is technical or non-technical?',
        level: 4,
      },
      {
        type: 'text',
        value:
          'We are licensed by NASBA and follow their guidelines for the subject area (field of study). See this document for more details from NASBA.',
      },
      {
        type: 'heading',
        value: 'Name on CPE Certificate',
        level: 4,
      },
      {
        type: 'text',
        value: 'The name printed on the CPE certificate will be the name on your Profile.',
      },
      {
        type: 'note',
        value:
          'Note that the name on the CPE Certificate needs to be as per your CPA/CMA certificate for the CPE Certificate to be accepted by State Boards of Accountancy (CPA) and IMA (CMA).',
        variant: 'warning',
      },
      {
        type: 'text',
        value: 'To edit your name follow the below path:',
      },
      {
        type: 'text',
        value:
          'Login > Click on Profile on the top LHC > Make the desired changes and click on Update',
      },
      {
        type: 'heading',
        value: 'How is CPE delivered on Miles Masterclass?',
        level: 4,
      },
      {
        type: 'heading',
        value: '01. Master Classes (Hollywood-Style Video Lessons)',
        level: 4,
      },
      {
        type: 'text',
        value:
          'Binge-worthy learning for finance professionals. Watch scripted, story-driven episodes that make accounting and finance come alive — while earning your annual CPE credits.',
      },
      {
        type: 'note',
        value: 'Delivery Mode: QAS Self-Study',
        variant: 'info',
      },
      {
        type: 'heading',
        value: '02. Podcasts',
        level: 4,
      },
      {
        type: 'text',
        value:
          'Conversations that inspire. Tune in to interviews with top leaders and innovators sharing real-world insights — and earn QAS Self-Study Credits as you listen.',
      },
      {
        type: 'note',
        value: 'Delivery Mode: QAS Self-Study',
        variant: 'info',
      },
      {
        type: 'heading',
        value: '03. Micro Learning (Reels for Accountants)',
        level: 4,
      },
      {
        type: 'text',
        value:
          'Short. Sharp. Skill-packed. Our Nano Learning videos deliver bite-sized lessons you can watch anytime, anywhere — perfect for busy professionals on the go.',
      },
      {
        type: 'note',
        value: 'Delivery Mode: QAS Self-Study',
        variant: 'info',
      },
      {
        type: 'heading',
        value: '04. Virtual Premieres',
        level: 4,
      },
      {
        type: 'text',
        value:
          'Be part of the first look. Join exclusive launch events for new Master Classes and earn CPE credits live — no dress code required.',
      },
      {
        type: 'note',
        value: 'Delivery Mode: Group Internet Based',
        variant: 'info',
      },
      {
        type: 'heading',
        value: 'What are the NASBA-approved delivery methods on Miles Masterclass?',
        level: 4,
      },
      {
        type: 'text',
        value:
          'Miles Masterclass offers two NASBA-approved learning modes for earning CPE credits:',
      },
      {
        type: 'heading',
        value: 'Group Internet-Based (GIB)',
        level: 4,
      },
      {
        type: 'description',
        value:
          '– Live, interactive sessions and virtual premieres conducted online, where participants engage in real time and earn credits based on active participation.',
      },
      {
        type: 'heading',
        value: 'QAS Self Study',
        level: 4,
      },
      {
        type: 'description',
        value:
          '– On-demand courses, podcasts, and nano learning modules that allow learners to study at their own pace and earn credits after successful completion and assessment.',
      },
    ],
  },
  {
    id: 2,
    question: 'Credits & Reporting',
    content: [
      {
        type: 'heading',
        value: 'How are CPE Credits calculated for a Group Internet Based (aka Premieres) session?',
        level: 4,
      },
      {
        type: 'text',
        value:
          'Sessions are measured by actual program length, with one 50-minute period equal to one CPE credit.',
      },
      {
        type: 'table',
        headers: [
          'Duration',
          'Number of Polling Questions to be Asked',
          'Number of Polling Questions to be Answered to be Eligible for CPE Certificate',
          'CPE Credits',
        ],
        rows: [
          ['60 minutes', '4', '3', '1.2'],
          ['90 minutes', '7', '6', '1.8'],
          ['120 minutes', '8', '7', '2.4'],
          ['180 minutes', '12', '11', '3.6'],
        ],
      },
      {
        type: 'heading',
        value: 'How do I earn CPE credit?',
        level: 4,
      },
      {
        type: 'subtext',
        value: 'Delivery Method - Group Internet Based (aka Webinar)',
      },
      {
        type: 'list',
        items: [
          'To earn credit for a Webinar (Group Internet-Based session), learners must remain logged into the session and answer the required number of poll questions to mark attendance.',
          'Polling questions will be posted at regular intervals throughout the Webinar session.',
          'Learners are required to answer "N-1" number of polling questions to be marked "Present" for the session (For example, if there are 5 polling questions, then participants are required to answer at least 4 polling questions to be marked present).',
          'Note that the purpose of the polling questions is to monitor active participation and there is no penalty for submitting the wrong answer.',
          'Learners will be informed regarding the number of polling questions to be answered at the start of the session.',
        ],
        ordered: false,
      },
      {
        type: 'subtext',
        value: 'Delivery Method - QAS Self-Study (aka Master Class, Podcast & Micro Learning)',
      },
      {
        type: 'list',
        items: [
          'To earn CPE credits for a Master Class, learners are required to complete all course content (i.e watch the recorded videos and answer the chapter quiz) and pass the exam with a minimum score of 70% within 1 year of enrolling for the course.',
        ],
        ordered: false,
      },
      {
        type: 'heading',
        value: 'How do I get the CPE Certificate?',
        level: 4,
      },
      {
        type: 'subtext',
        value: 'Delivery Method - Group Internet Based (aka Webinar)',
      },
      {
        type: 'list',
        items: [
          'Learners need to submit the evaluation feedback from the "Premieres Attended" section for the session they attended.',
          'Note that the Evaluation Feedback form will be pre-populated with the "Name" and "Email-ID" used at the time of registration.',
          'Once the form is filled and submitted, learners can download their CPE Certificate (in case the attendance status is "Present") under the "Premieres Attended" or from the CPE tracker "Completed" section.',
        ],
        ordered: false,
      },
      {
        type: 'subtext',
        value: 'Delivery Method - QAS Self Study (aka Master Class, Podcast & Micro Learning)',
      },
      {
        type: 'list',
        items: [
          'Learners who have scored a minimum of 70% in the exam, will have the option to fill the evaluation feedback for the course after review of the exam results.',
          'Once the evaluation feedback is submitted learners can download their CPE Certificate and Miles Learning Certificate under the Recently Watched Section in the Master Class Tab.',
          'Note that the Evaluation Feedback form will be pre-populated with the "Name" and "Email-ID" used at the time of registration.',
          'Once the form is filled and submitted, learners can download their CPE Certificate under the "Courses You\'ve Mastered" section or from the CPE tracker "Completed" section.',
        ],
        ordered: false,
      },
      {
        type: 'heading',
        value: 'Why did I not earn the CPE credit?',
        level: 4,
      },
      {
        type: 'subtext',
        value: 'Delivery Method - Group Internet Based (aka Premieres)',
      },
      {
        type: 'text',
        value: 'Please consider the following:',
      },
      {
        type: 'list',
        items: [
          'Has it been at least 48 hours since the Webinar ended?',
          'Did you answer the required number of polling questions?',
          'Did you complete and submit the session evaluation feedback?',
          'Did you login to the premiere using a different name or email address than what is listed in your profile?',
          'Did you have an active CPE subscription at the time of attending the Webinar or purchased the course certificate?',
        ],
        ordered: true,
      },
      {
        type: 'text',
        value:
          'If the answer to either of the questions is "NO", you will not receive the NASBA approved CPE certificate.',
      },
      {
        type: 'text',
        value:
          "If you believe you should have been issued a certificate or may have logged into the Webinar with a different name or email address than what's listed in your profile, please email support@milesmasterclass.com and include the possible alternative names and email address that were used (for example: Varun Jain vs. Varun Jain II or varunjain@mileseducation.com vs varunjain2@mileseducation.com) along with the name of the session.",
      },
      {
        type: 'subtext',
        value: 'Delivery Method - QAS Self-Study (aka Master Class, Podcast & Micro Learning)',
      },
      {
        type: 'text',
        value: 'Please consider the following:',
      },
      {
        type: 'list',
        items: [
          'Did you complete the course in CPE Mode?',
          'Did you score 70% or more in the exam?',
          'Did you pass the exam with a score of 70% within 1 year of enrolling/launching the course?',
          'Did you complete and submit the session evaluation feedback after passing the exam?',
          'Has it been 48 hours since the feedback was submitted?',
        ],
        ordered: true,
      },
      {
        type: 'text',
        value:
          'If all of the above are satisfied, kindly drop an email to support@milesmasterclass.com mentioning the name of the Master Class.',
      },
      {
        type: 'heading',
        value: 'Registered but did not attend the premiere',
        level: 4,
      },
      {
        type: 'subtext',
        value: 'Delivery Method - Group Internet Based (aka Premieres)',
      },
      {
        type: 'list',
        items: [
          'If you registered for a Webinar (Group Internet-Based) session but didn\'t attend, you\'ll be marked as "Absent."',
          'You can easily find all the sessions you missed under the "Premieres You\'ve Missed" section in the Webinar Tab.',
        ],
        ordered: false,
      },
      {
        type: 'subtext',
        value: 'Delivery Method - QAS Self Study (aka Master Class, Podcast & Micro Learning)',
      },
      {
        type: 'list',
        items: [
          'If the learner has not passed the exam with a score of 70% or above within one year of enrolling/launching the Master Class course, the course progress will be wiped out.',
          'The learner will be required to redo the course in CPE Mode as per NASBA guidelines.',
        ],
        ordered: false,
      },
      {
        type: 'heading',
        value: 'Locating Course Evaluation Feedback',
        level: 4,
      },
      {
        type: 'text',
        value:
          'Follow this path to access and submit the Course Evaluation Feedback (where applicable):',
      },
      {
        type: 'subtext',
        value: 'Delivery Method - Group Internet Based (aka Premieres)',
      },
      {
        type: 'list',
        items: [
          'Login > Click on Premieres > Scroll down to the "Premieres Attended" section',
          'Locate the premiere(s) in question > Hover on the card and click on the "Feedback" button.',
        ],
        ordered: false,
      },
      {
        type: 'subtext',
        value: 'Delivery Method - QAS Self Study (aka Master Class, Podcast & Micro Learning)',
      },
      {
        type: 'list',
        items: [
          'Login > Click on Master Class > Scroll down to the "Courses You\'ve Mastered" section',
          'Locate the Master Class(es) in question > Hover on the card and click on the "Feedback" button.',
        ],
        ordered: false,
      },
      {
        type: 'heading',
        value: 'Locating CPE Certificates',
        level: 4,
      },
      {
        type: 'text',
        value: 'Follow this path to download the CPE Certificates (where applicable):',
      },
      {
        type: 'subtext',
        value: 'Delivery Method - Group Internet Based (aka Premieres)',
      },
      {
        type: 'list',
        items: [
          'Login > Click on Premieres > Scroll down to the "Premieres Attended" section',
          'Locate the premiere(s) in question > Hover on the card and click on the "Download Certificate" button.',
          'PLEASE NOTE: You will need to complete the "Course Evaluation Feedback" before the certificate will be processed.',
        ],
        ordered: false,
      },
      {
        type: 'subtext',
        value: 'Delivery Method - QAS Self Study (aka Master Class, Podcast & Micro Learning)',
      },
      {
        type: 'list',
        items: [
          'Login > Click on Master Class > Scroll down to the "Courses You\'ve Mastered" section',
          'Locate the Master Class(es) in question > Hover on the card and click on the "Download Certificate" button.',
          'PLEASE NOTE: You will need to complete the "Course Evaluation Feedback" before the certificate will be processed.',
        ],
        ordered: false,
      },
    ],
  },
  {
    id: 3,
    question: 'Payment, Cancellation & Refund',
    content: [
      {
        type: 'heading',
        value: 'Is There a Fee to Register or Attend a Premier?',
        level: 4,
      },
      {
        type: 'text',
        value:
          'Nope! Premieres are absolutely free — no hidden costs, no strings attached. Just sign up to register and attend.',
      },
      {
        type: 'text',
        value:
          "When you sign up and subscribe, you'll gain access to Miles Masterclass and its full library of AI-powered learning content.",
      },
      {
        type: 'text',
        value:
          'Please note: To download the CPE certificate (provided you meet the eligibility criteria** - see the Credits & Reporting section), you must have an active subscription.',
      },
      {
        type: 'note',
        value:
          '*CPE Certificates, CPE tracking, and LinkedIn-ready digital badges are exclusive to subscribers.',
        variant: 'info',
      },
      {
        type: 'note',
        value:
          '**For more details on earning CPE credits, check out the Credits and Reporting section ("How do I earn CPE credits?").',
        variant: 'info',
      },
      {
        type: 'note',
        value:
          'Please Note: Miles Masterclass Inc. reserves the right to modify its payment policy at any time. Any changes will be communicated to registered members at least 7 days in advance before taking effect.',
        variant: 'warning',
      },
      {
        type: 'heading',
        value: 'Is There a Fee to Access Master Class Video/Course Content?',
        level: 4,
      },
      {
        type: 'text',
        value: 'You can watch the course trailer and sample video at no cost - no signup required.',
      },
      {
        type: 'text',
        value:
          'To unlock the full course content, simply create your Miles Masterclass account, subscribe, and start learning.',
      },
      {
        type: 'text',
        value: 'To earn a NASBA-approved CPE Certificate, you must:',
      },
      {
        type: 'list',
        items: [
          'Access the course in CPE Mode',
          'Meet the eligibility criteria** - including scoring at least 70% on assessments within one year of enrolling or launching the course',
          'Have an active subscription *',
        ],
        ordered: false,
      },
      {
        type: 'note',
        value:
          '*CPE Certificates, the CPE Tracker, and LinkedIn-ready Digital Badges are exclusive to subscribers.',
        variant: 'info',
      },
      {
        type: 'note',
        value:
          '**Check out the Credits & Reporting section ("How do I earn CPE credits?") for full details.',
        variant: 'info',
      },
      {
        type: 'heading',
        value: 'Do I Have to Pay to Download the CPE Certificate?',
        level: 4,
      },
      {
        type: 'subtext',
        value: 'Delivery Method - Group Internet Based (aka Premiers/Webinars)',
      },
      {
        type: 'list',
        items: [
          'Registering for and attending a Webinar is completely free - no payment or subscription required to participate.',
          'However, to download the CPE Certificate, you must have an active subscription and meet the eligibility criteria* (subject to conditions).',
        ],
        ordered: false,
      },
      {
        type: 'note',
        value:
          '*For more details on earning CPE credits, check out the Credits and Reporting section ("How do I earn CPE credits?").',
        variant: 'info',
      },
      {
        type: 'subtext',
        value: 'Delivery Method - QAS Self Study (aka Masterclass)',
      },
      {
        type: 'text',
        value:
          'To download the CPE certificate for a launched and completed Master Class course in CPE Mode, you must have an active subscription and meet the eligibility criteria*.',
      },
      {
        type: 'note',
        value:
          '*For more details on earning CPE credits, check out the Credits and Reporting section ("How do I earn CPE credits?").',
        variant: 'info',
      },
      {
        type: 'heading',
        value: 'Are payments made on a secure connection?',
        level: 4,
      },
      {
        type: 'subtext',
        value: 'For purchases made on the website',
      },
      {
        type: 'list',
        items: [
          'We use a tool that processes payments called Stripe (https://stripe.com/). Stripe uses an HTTPS protocol to secure all online transactions.',
          "We don't directly store any of your payment information.",
          'All transactional information is processed by Stripe, and a receipt from Stripe is used to confirm your payment.',
        ],
        ordered: false,
      },
      {
        type: 'subtext',
        value: 'For purchases made on App Store (Apple)',
      },
      {
        type: 'list',
        items: [
          'Apple ID Authentication – Users must sign in with their Apple ID and authenticate using Face ID, Touch ID, or a password.',
          'Secure Payment Processing – Apple processes all transactions using encrypted payment methods, including credit/debit cards, Apple Pay, and PayPal.',
          "Receipt Validation – Apps must validate purchase receipts with Apple's servers to confirm authenticity and prevent fake purchases.",
        ],
        ordered: false,
      },
      {
        type: 'subtext',
        value: 'For purchases made on Play Store (Android)',
      },
      {
        type: 'list',
        items: [
          'Google Account Authentication – Users must log in with their Google account, with optional biometric authentication (fingerprint or face unlock).',
          "Google Play Billing System – All transactions go through Google's secure payment system, encrypting payment details.",
          'Play Protect & Fraud Detection – Google Play Protect continuously scans for suspicious activity and unauthorized transactions.',
        ],
        ordered: false,
      },
      {
        type: 'heading',
        value: 'Where Can I Download My Order Confirmation?',
        level: 4,
      },
      {
        type: 'list',
        items: [
          'You can download your order confirmation from the Order History section.',
          'Additionally, you should have received an email from Stripe upon successfully placing your order.',
          "If you can't find the email, please check your spam or promotions folder.",
        ],
        ordered: false,
      },
      {
        type: 'heading',
        value: 'I Have an Active Subscription. Do I Still Need to Pay for the Certificate?',
        level: 4,
      },
      {
        type: 'text',
        value: 'It depends:',
      },
      {
        type: 'list',
        items: [
          'If the course is not covered under your subscription, you will need to pay for the certificate.',
          "If your subscription has a course limit and you've reached the maximum number of courses covered, you will need to pay for additional courses.",
          "Check your subscription details to see what's included!",
        ],
        ordered: false,
      },
      {
        type: 'heading',
        value: 'Subscription Policy',
        level: 4,
      },
      {
        type: 'subtext',
        value: 'Pro Plan - $1799/year',
      },
      {
        type: 'subtext',
        value: 'What You Get',
      },
      {
        type: 'list',
        items: [
          'Full access to 22+ categories: Master Classes, Podcast, and Micro-Learning Reels.',
          'Watch on Desktop and Mobile Devices',
          'New Courses Added Every Month',
          'Pay Securely Using Major Credit Cards',
          'NASBA-Approved CPE Certificates*',
          'Credly Digital Badge* to Share on LinkedIn',
          'Certified AI Ready Accountant Digital Badge*',
          'Track compliance with CPE Tracker',
        ],
        ordered: false,
      },
      {
        type: 'note',
        value: '*Refer to the Credits & Reporting and CAIRA sections in the FAQs to learn more.',
        variant: 'info',
      },
      {
        type: 'subtext',
        value: 'Enterprise Plan - Custom Pricing',
      },
      {
        type: 'subtext',
        value: 'What You Get',
      },
      {
        type: 'list',
        items: [
          'All benefits of the Pro plan',
          'Dedicated customer success manager',
          'Organizational membership management',
          'Analytics and adoption reports',
        ],
        ordered: false,
      },
      {
        type: 'heading',
        value: 'How do I cancel my subscription?',
        level: 4,
      },
      {
        type: 'subtext',
        value: 'For Website Subscriptions:',
      },
      {
        type: 'list',
        items: [
          'You can only cancel the auto-renewal of your subscription. Your subscription will remain active until the end of the current billing period.',
          'To cancel auto-renewal, follow these steps on our website: Login > Plan Section > Click on "Cancel Renewal"',
          'This will disable auto-pay, ensuring your subscription does not renew at the end of the billing cycle.',
          'Refunds will not be provided for partial or unused subscription periods.',
        ],
        ordered: false,
      },
      {
        type: 'subtext',
        value: 'For iOS (App Store) Subscriptions:',
      },
      {
        type: 'list',
        items: [
          'You can only cancel the auto-renewal of your subscription. Your subscription will remain active until the end of the current billing period.',
          'To cancel auto-renewal, follow these steps:',
          'Open Settings on your iPhone or iPad.',
          'Tap your Apple ID (your name at the top).',
          'Select Subscriptions.',
          'Find and tap on your Miles Masterclass subscription.',
          'Tap Cancel Subscription and confirm.',
          'This will stop auto-renewal, and your subscription will not renew at the end of the billing cycle.',
          'Refunds will not be provided for partial or unused subscription periods.',
        ],
        ordered: false,
      },
      {
        type: 'subtext',
        value: 'For Android (Google Play) Subscriptions:',
      },
      {
        type: 'list',
        items: [
          'You can only cancel the auto-renewal of your subscription. Your subscription will remain active until the end of the current billing period.',
          'To cancel auto-renewal, follow these steps:',
          'Open the Google Play Store on your Android device.',
          'Tap your profile icon (top-right corner).',
          'Select Payments & Subscriptions > Subscriptions.',
          'Find and tap on your Miles Masterclass subscription.',
          'Tap Cancel Subscription and confirm.',
          'This will stop auto-renewal, and your subscription will not renew at the end of the billing cycle.',
          'Refunds will not be provided for partial or unused subscription periods.',
        ],
        ordered: false,
      },
      {
        type: 'heading',
        value: 'Subscription Renewal Policy',
        level: 4,
      },
      {
        type: 'list',
        items: [
          'You can renew your subscription before it expires by following either of these steps:',
          'From the Plan Page: Click the "Reactivate Renewal" button.',
          'From Order History: Navigate to your current subscription, click on "Actions", and select "Renew".',
        ],
        ordered: false,
      },
      {
        type: 'heading',
        value: 'Refund Policy',
        level: 4,
      },
      {
        type: 'list',
        items: [
          'All online purchases are final, and no refunds will be issued under any circumstances.',
          'Once a payment is successfully processed, it is non-refundable and non-transferable.',
          'We encourage users to carefully review course details, terms, and conditions before making a purchase.',
          'If you have any questions or need clarification, please contact our support team before completing your transaction.',
          'Refunds will not be provided for partial or unused subscription periods.',
        ],
        ordered: false,
      },
    ],
  },
  {
    id: 4,
    question: 'Technical Support',
    content: [
      {
        type: 'heading',
        value: 'Not able to Signup/Login',
        level: 4,
      },
      {
        type: 'text',
        value: 'Drop an email to support@milesmasterclass.com',
      },
      {
        type: 'heading',
        value:
          'How do I change my account details such as my name, email address, phone number, etc?',
        level: 4,
      },
      {
        type: 'text',
        value: 'Log in and click on Edit Profile to change your Name and Location.',
      },
      {
        type: 'note',
        value: 'Note that Email ID and Mobile Number cannot be edited.',
        variant: 'warning',
      },
      {
        type: 'note',
        value:
          'Note that the Name on your profile will be the name that is printed on the CPE Certificate. Your Name needs to be as per your CPA/CMA certificate for the CPE Certificate to be accepted by State Boards of Accountancy (CPA) and IMA (CMA).',
        variant: 'warning',
      },
      {
        type: 'heading',
        value: 'Compliant Policy',
        level: 4,
      },
      {
        type: 'text',
        value:
          'Miles Masterclass Inc. ensures that all its programs provide updated content taking into consideration the latest amendments and is committed to providing the most beneficial and satisfactory experience to all its course users.',
      },
      {
        type: 'text',
        value:
          'In the event any participant is not completely satisfied with any Group Internet-based courses or of the QAS Self-Study courses and wishes to file a complaint, please contact support@milesmasterclass.com within 10 business days of the event. Miles Masterclass Inc. shall ensure satisfactory resolution of each and every complaint filed.',
      },
      {
        type: 'heading',
        value: 'Other queries?',
        level: 4,
      },
      {
        type: 'text',
        value: 'For any other queries drop an email to support@milesmasterclass.com',
      },
    ],
  },
  {
    id: 5,
    question: 'CAIRA (Certified AI Ready Accountant)',
    content: [
      {
        type: 'heading',
        value: 'What is CAIRA Level 1?',
        level: 4,
      },
      {
        type: 'text',
        value:
          "CAIRA (Certified AI Ready Accountant – Level 1) is a digital certification by Miles Masterclass, co-created with global accounting and AI leaders. It's designed to help accountants build future-ready, AI-powered skills and earn a Credly-verified digital badge upon completion.",
      },
      {
        type: 'heading',
        value: 'Who is CAIRA for?',
        level: 4,
      },
      {
        type: 'text',
        value:
          "CAIRA is designed for accounting and finance professionals who want to stay ahead in the AI era — whether you're advancing your career, pivoting to a tech-driven role, or gaining in-demand skills to lead the transformation.",
      },
      {
        type: 'heading',
        value: "What's included in CAIRA Level 1?",
        level: 4,
      },
      {
        type: 'list',
        items: [
          '30 CPE hours of expert-led learning content',
          'Lessons, quizzes, and activities designed for practical application',
          'Insights from global leaders in AI and accounting',
          'Auto-tracked CPE credits',
          'A Credly digital badge you can showcase on LinkedIn',
        ],
        ordered: false,
      },
      {
        type: 'heading',
        value: 'How long does it take to complete?',
        level: 4,
      },
      {
        type: 'text',
        value:
          "You can complete CAIRA Level 1 in about 30 hours — or learn at your own pace. You'll have continued access to revisit content at any time during your subscription.",
      },
      {
        type: 'heading',
        value: 'Is CAIRA included in my Miles Masterclass subscription?',
        level: 4,
      },
      {
        type: 'text',
        value:
          'Yes! CAIRA Level 1 is included as part of your Miles Masterclass subscription — giving you full access to the certification content, CPE tracking, and your Credly-verified badge at no additional cost.',
      },
      {
        type: 'note',
        value:
          'For more details regarding the Subscription Policy, check out the Payments, Cancellations & Refund section ("Subscription Policy")',
        variant: 'info',
      },
      {
        type: 'heading',
        value: 'How much does CAIRA Level 1 cost?',
        level: 4,
      },
      {
        type: 'text',
        value:
          'CAIRA Level 1 comes free with your active Miles Masterclass subscription. Simply subscribe to Miles Masterclass to unlock access and start your certification journey.',
      },
      {
        type: 'heading',
        value: 'Can I share my CAIRA credential?',
        level: 4,
      },
      {
        type: 'text',
        value:
          'Absolutely. Your CAIRA Level 1 credential is issued via Credly — a globally recognized digital badge platform — and can be showcased on LinkedIn, your résumé, or other professional platforms.',
      },
      {
        type: 'heading',
        value: 'Can I access CAIRA on the Miles Masterclass App?',
        level: 4,
      },
      {
        type: 'text',
        value:
          'Yes! You can learn, track your progress, earn CPE credits, and claim your CAIRA Level 1 Credly badge — all directly through the Miles Masterclass App or website.',
      },
    ],
  },
];

/**
 * Per-locale overrides. Empty today — add a `${country}:${profession}` key
 * (lowercased) when an FAQ list diverges per market.
 */
const LOCALE_OVERRIDES: Partial<Record<LocaleKey, FAQ[]>> = {
  // 'in:accounting': IN_ACCOUNTING_FAQS,
};

/** Returns the right FAQ list for the active locale. */
export const resolveFaqData = (country: CountryCode, profession: ProfessionType): FAQ[] =>
  resolveByLocale(LOCALE_OVERRIDES, FAQ_DATA, country, profession);
