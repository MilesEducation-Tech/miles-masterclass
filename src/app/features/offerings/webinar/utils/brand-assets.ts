/**
 * Static art the webinar surfaces render: remote brand marks, and the one
 * inline SVG the designs ship that no icon pack carries.
 *
 * Brand marks the webinar surfaces render as images rather than text.
 *
 * These live on the same CloudFront bucket the rest of the site's static art
 * comes from, and are referenced by absolute URL for the same reason: they are
 * shared with the marketing site and the mobile app, so a copy in `public/`
 * would be a second thing to keep in step.
 *
 * `caira` is the wordmark WITH its "Certified AI-Ready Accountant" lockup
 * baked in, white on transparent at 2616×838 (≈3.12:1). Size it by height and
 * let the width follow; it is invisible on a light surface.
 */
export const BRAND_MARKS = {
  caira:
    'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/caira-logo-white.webp',
  credly: 'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/credly.webp',
} as const;

/**
 * The ticket on the "Register Now" button.
 *
 * Taken from the design's export, with one change: its `stroke="black"` is
 * `currentColor` here. Hardcoded black renders the mark invisible the moment
 * the button is anything other than the white variant — and the CTA already
 * switches to `primary` in the `join-open` state.
 */
/*
 * Kept as a string and handed to `<ng-icon [svg]="…">` rather than registered
 * through `provideIcons`: it comes from the design files, not an icon pack, so
 * there is no name to register it under and a registration entry would be
 * indirection with nothing on the other end.
 */
export const TICKET_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none"><g clip-path="url(#mm-ticket-clip)"><path d="M7.5832 2.91626V4.08306M7.5832 9.91706V11.0839M7.5832 6.41666V7.58346M1.16602 5.24986C1.63018 5.24986 2.07534 5.43426 2.40355 5.76248C2.73177 6.09071 2.91616 6.53588 2.91616 7.00006C2.91616 7.46424 2.73177 7.90941 2.40355 8.23764C2.07534 8.56587 1.63018 8.75026 1.16602 8.75026V9.91706C1.16602 10.2265 1.28894 10.5233 1.50775 10.7421C1.72656 10.9609 2.02333 11.0839 2.33278 11.0839H11.6669C11.9763 11.0839 12.2731 10.9609 12.4919 10.7421C12.7107 10.5233 12.8336 10.2265 12.8336 9.91706V8.75026C12.3695 8.75026 11.9243 8.56587 11.5961 8.23764C11.2679 7.90941 11.0835 7.46424 11.0835 7.00006C11.0835 6.53588 11.2679 6.09071 11.5961 5.76248C11.9243 5.43426 12.3695 5.24986 12.8336 5.24986V4.08306C12.8336 3.77361 12.7107 3.47683 12.4919 3.25801C12.2731 3.03919 11.9763 2.91626 11.6669 2.91626H2.33278C2.02333 2.91626 1.72656 3.03919 1.50775 3.25801C1.28894 3.47683 1.16602 3.77361 1.16602 4.08306V5.24986Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></g><defs><clipPath id="mm-ticket-clip"><rect width="14" height="14" fill="white"/></clipPath></defs></svg>`;
