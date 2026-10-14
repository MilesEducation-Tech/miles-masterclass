import type { UtilsDialogData } from '@shared/dialogs/utils-dialog/utils-dialog';

/** One step of the cart → billing → review progress bar. */
export interface CartSteps {
  id: number;
  name: string | null;
  step: number;
  icon: string | null;
  active: boolean;
}

export const SIGNUP_DIALOG_DATA: UtilsDialogData = {
  containerClass: 'py-12 px-6',
  content: [
    { type: 'heading', value: 'Sign in or Log in to Access Course Content!', level: 3 },
    {
      type: 'text',
      value:
        'Unlock exclusive access to all course materials. Sign in or log in now to start learning and dive into the content!',
    },
  ],
  buttons: [{ label: 'Signup', variant: 'default', action: 'confirm' }],
};

/** Two steps: the review step collects the billing address itself. */
export const PATH_TYPE_TO_STEP_ID: Record<string, number> = {
  cart: 1,
  review: 3,
};

export const CART_STEP_DATA: Omit<CartSteps, 'active'>[] = [
  {
    id: 1,
    name: 'Cart',
    step: 1,
    icon: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24.8089 29.1016H7.18891C6.62585 29.1027 6.07865 28.9152 5.63459 28.569C5.19053 28.2228 4.8752 27.7379 4.73891 27.1916L1.49891 14.1916C1.41318 13.8224 1.41183 13.4387 1.49494 13.0689C1.57806 12.6991 1.74351 12.3529 1.97897 12.0559C2.21442 11.759 2.51383 11.5189 2.8549 11.3537C3.19597 11.1884 3.56992 11.1023 3.94891 11.1016H28.0489C28.4322 11.1008 28.8106 11.1875 29.1553 11.355C29.5 11.5225 29.802 11.7665 30.0382 12.0683C30.2745 12.3701 30.4388 12.7218 30.5186 13.0967C30.5984 13.4716 30.5917 13.8597 30.4989 14.2316L27.2589 27.2316C27.1151 27.7705 26.7965 28.2464 26.3531 28.5848C25.9098 28.9232 25.3666 29.1049 24.8089 29.1016ZM3.94891 13.1016C3.869 13.1006 3.78993 13.118 3.71785 13.1525C3.64577 13.187 3.58261 13.2377 3.53328 13.3005C3.48395 13.3634 3.44977 13.4368 3.43341 13.515C3.41704 13.5932 3.41892 13.6742 3.43891 13.7516L6.67891 26.7516C6.708 26.8643 6.77406 26.964 6.86653 27.0347C6.95899 27.1054 7.07251 27.143 7.18891 27.1416H24.8089C24.9236 27.1408 25.0348 27.1021 25.1252 27.0316C25.2157 26.9611 25.2802 26.8626 25.3089 26.7516L28.5489 13.7516C28.5689 13.6742 28.5708 13.5932 28.5544 13.515C28.538 13.4368 28.5039 13.3634 28.4545 13.3005C28.4052 13.2377 28.342 13.187 28.27 13.1525C28.1979 13.118 28.1188 13.1006 28.0389 13.1016H3.94891Z" fill="white"/>
        <path d="M8.10844 12.7118L6.39844 11.7118L11.3984 3.4118C11.5235 3.17888 11.7358 3.00497 11.9888 2.92814C12.2418 2.8513 12.5149 2.87779 12.7484 3.0018C12.9748 3.13874 13.1377 3.3598 13.2014 3.61657C13.2651 3.87335 13.2245 4.14492 13.0884 4.3718L8.10844 12.7118ZM23.8884 12.7118L18.8884 4.4118C18.8155 4.29669 18.7668 4.16789 18.7455 4.0333C18.7241 3.8987 18.7305 3.76116 18.7642 3.62912C18.7979 3.49708 18.8582 3.37332 18.9415 3.26545C19.0248 3.15757 19.1292 3.06785 19.2484 3.0018C19.4753 2.86572 19.7469 2.82509 20.0037 2.88882C20.2604 2.95255 20.4815 3.11543 20.6184 3.3418L25.6184 11.6418L23.8884 12.7118Z" fill="white"/>
        <path d="M20 22.6328H12C11.4477 22.6328 11 23.0805 11 23.6328C11 24.1851 11.4477 24.6328 12 24.6328H20C20.5523 24.6328 21 24.1851 21 23.6328C21 23.0805 20.5523 22.6328 20 22.6328Z" fill="white"/>
        </svg>`,
  },
  {
    id: 2,
    name: null,
    step: 2,
    icon: null,
  },
  {
    id: 3,
    name: 'Review',
    step: 3,
    icon: `<svg width="32" height="32" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g>
    <path d="M3.33203 5.66406C3.33203 3.45492 5.12289 1.66406 7.33203 1.66406H12.5085C13.5694 1.66406 14.5868 2.08549 15.3369 2.83564L17.1605 4.65916C17.9106 5.4093 18.332 6.42672 18.332 7.48758V14.3307C18.332 16.5399 16.5412 18.3307 14.332 18.3307H7.33203C5.12289 18.3307 3.33203 16.5399 3.33203 14.3307V5.66406Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M7.5 5.83594L14.1667 5.83594" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M7.5 10H14.1667" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M7.5 14.1641H10.8333" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    </g>
    </svg>
    `,
  },
];
