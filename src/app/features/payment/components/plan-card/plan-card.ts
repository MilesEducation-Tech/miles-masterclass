import { Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NgIcon } from '@ng-icons/core';
import { SubscriptionPlan } from '@core/models/payment.model';
import { environment } from '@env/environment';

const freeTrialIcon = `<svg width="84" height="84" viewBox="0 0 84 84" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_45617_77119)"><path d="M22.6685 82.6465C23.6884 82.6213 24.4902 81.4659 24.4557 80.0709L24.183 69.02L20.5513 74.2663C18.9491 76.5756 18.9822 80.1644 20.5596 82.6985L22.6685 82.6465Z" fill="#FFEE58"/><path d="M20.4281 69.3051L68.2044 18.9909C71.0597 15.9908 75.0977 14.8672 78.9388 15.6295L66.0971 3.40609C62.1451 -0.355315 55.7997 -0.465442 52.0389 3.48686L4.17459 53.7734C0.413189 57.7258 0.761121 63.9868 4.71316 67.7482L17.4812 79.9017C16.6747 76.1872 17.6408 72.2335 20.4281 69.3051Z" fill="#FFEE58"/><path d="M73.1141 19.849L68.9847 24.0394L78.3251 23.8089C79.5467 23.7788 80.5169 22.7966 80.4878 21.6195L80.4347 19.4668C78.1481 17.7801 75.0304 17.9088 73.1141 19.849Z" fill="#FFEE58"/><path d="M30.3242 51.1312L28.6675 52.8717L20.3245 44.9306L24.8763 40.1485L26.3257 41.5282L23.4307 44.5698L25.582 46.6175L28.2761 43.7871L29.7199 45.1613L27.0258 47.9917L30.3242 51.1312ZM28.7436 36.0855C29.4642 35.3284 30.1494 34.7914 30.7991 34.4744C31.4525 34.1537 32.0777 34.0491 32.6749 34.1607C33.272 34.2722 33.8521 34.596 34.4152 35.1319C34.7956 35.494 35.0597 35.8832 35.2074 36.2993C35.3552 36.7155 35.4157 37.1356 35.389 37.5598C35.3623 37.984 35.2814 38.3927 35.1462 38.7862L41.1169 39.7923L39.2484 41.7554L34.1514 40.6998L33.2551 41.6414L36.4565 44.6885L34.7727 46.4576L26.4297 38.5165L28.7436 36.0855ZM30.0736 37.5907L29.563 38.1271L31.8171 40.2726L32.3603 39.7019C32.9179 39.1161 33.2192 38.6052 33.2642 38.1695C33.309 37.7263 33.1412 37.3236 32.7607 36.9615C32.3651 36.5849 31.9532 36.4539 31.5251 36.5685C31.1006 36.6793 30.6167 37.02 30.0736 37.5907ZM46.6898 33.9374L42.1163 38.7423L33.7733 30.8012L38.3468 25.9963L39.7963 27.3759L36.9066 30.4118L38.7384 32.1554L41.4271 29.3306L42.8766 30.7103L40.1879 33.535L42.3393 35.5828L45.2289 32.5469L46.6898 33.9374ZM52.9253 27.3863L48.3519 32.1912L40.0089 24.2501L44.5824 19.4452L46.0318 20.8248L43.1422 23.8607L44.974 25.6043L47.6627 22.7795L49.1121 24.1592L46.4234 26.9839L48.5748 29.0316L51.4645 25.9957L52.9253 27.3863Z" fill="black"/></g><defs><clipPath id="clip0_45617_77119"><rect width="81.2247" height="81.2247" fill="white" transform="translate(0 2.00398) rotate(-1.41375)"/></clipPath></defs></svg>`;

const proCrownIcon = `<svg width="19" height="17" viewBox="0 0 19 17" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.33086 16.421C7.30157 16.4383 7.30157 16.4383 7.27227 16.4556C7.24297 16.4729 7.19593 16.4616 7.19593 16.4616C7.1489 16.4504 7.10186 16.4391 7.08411 16.4105C7.05482 16.4278 7.03708 16.3993 7.01933 16.3707L0.0453183 9.00869C0.00983368 8.95155 -0.0140969 8.84853 0.00901109 8.75677C0.0791577 8.67629 0.167047 8.62438 0.29042 8.62961L5.07516 9.43532C5.1222 9.44659 5.18698 9.48643 5.22246 9.54358L6.35096 11.103C6.38644 11.1601 6.37489 11.206 6.38108 11.2804C6.36952 11.3263 6.32867 11.3895 6.27008 11.4241C5.74275 11.7356 5.56944 12.4237 5.8888 12.938L6.04848 13.1952C6.36784 13.7095 7.07342 13.8785 7.60075 13.567L9.91516 12.2C10.4425 11.8886 10.6158 11.2004 10.2964 10.6861L10.1368 10.429C9.8174 9.91467 9.11182 9.74564 8.58449 10.0571C8.4966 10.109 8.37323 10.1038 8.2907 10.0354L6.351 8.33028C6.31551 8.27314 6.28003 8.216 6.27384 8.14155L6.62339 3.28793C6.62339 3.28793 6.65269 3.27063 6.63495 3.24206C6.66424 3.22475 6.6465 3.19618 6.6758 3.17888C6.68735 3.133 6.71665 3.1157 6.74594 3.09839C6.77524 3.08109 6.80454 3.06378 6.85157 3.07505C6.88087 3.05775 6.89861 3.08632 6.92791 3.06902L6.97495 3.08029L11.5472 5.02686C11.612 5.0667 11.6474 5.12385 11.6829 5.18099L12.275 7.68206C12.2989 7.78508 12.2465 7.89413 12.1586 7.94604C11.602 8.27482 11.4287 8.96296 11.7481 9.47726L11.9077 9.73441C12.2271 10.2487 12.9327 10.4177 13.46 10.1063L15.8037 8.72196C16.331 8.41049 16.4928 7.76823 16.1557 7.22536L15.996 6.96821C15.6767 6.45391 15.0004 6.26758 14.4553 6.55047C14.3381 6.61969 14.197 6.58588 14.126 6.47159L13.1325 4.87155C13.097 4.8144 13.0908 4.73995 13.1023 4.69408L14.587 0.185353C14.6394 0.0762974 14.7096 -0.00418668 14.8329 0.00104692C14.9093 -0.00498875 14.9918 0.063424 15.045 0.149141L18.5035 9.58761C18.5452 9.7192 18.4927 9.82826 18.4049 9.88017L7.33086 16.421Z" fill="#FFCF00"/></svg>`;

export type PlanAction = 'subscribe' | 'free-trial' | 'enquire' | 'firm-sponsorship' | 'signup';

@Component({
  selector: 'app-plan-card',
  imports: [CurrencyPipe, NgIcon],
  templateUrl: './plan-card.html',
})
export class PlanCard {
  readonly plan = input.required<SubscriptionPlan>();
  readonly isLoggedIn = input(false);
  readonly actionClicked = output<{ plan: SubscriptionPlan; action: PlanAction }>();

  readonly S3_BUCKET_URL = environment.S3_BUCKET_URL;
  readonly freeTrialIcon = freeTrialIcon;
  readonly proCrownIcon = proCrownIcon;

  readonly isFreePlan = computed(() => this.plan().is_unlimited_trial_enabled);
  readonly isRecommended = computed(() => this.plan().is_recommended);
  readonly isEnterprise = computed(() => this.plan().subscription_type === 'pay_per_course');
  readonly isAlreadySubscribed = computed(() => this.plan().is_in_myorder !== null);
  readonly isAddedToCart = computed(() => this.plan().is_added_to_cart);

  readonly priceDisplay = computed(() => {
    const plan = this.plan();
    if (plan.is_unlimited_trial_enabled) {
      return { label: 'Unlimited Free Trial', amount: null, basePrice: null };
    }
    if (plan.subscription_type === 'pay_per_course') {
      return { label: 'Custom Pricing', amount: null, basePrice: null };
    }
    const price = plan.price_detail;
    if (!price) return { label: 'Contact Us', amount: null, basePrice: null };
    const duration = plan.plan_duration >= 12 ? 'Year' : `${plan.plan_duration} Mo`;
    const hasDiscount = price.base_price > price.selling_price;
    return {
      label: null,
      amount: price.selling_price,
      basePrice: hasDiscount && plan.is_recommended ? price.base_price : null,
      symbol: price.currency_symbol,
      currency: price.currency_code,
      duration,
    };
  });

  readonly buttonConfig = computed(() => {
    const plan = this.plan();
    const loggedIn = this.isLoggedIn();

    if (plan.subscription_type === 'pay_per_course') {
      return {
        label: 'Enquire Now',
        disabled: false,
        action: 'enquire' as PlanAction,
        variant: 'enterprise',
      };
    }
    if (!loggedIn) {
      if (plan.is_unlimited_trial_enabled) {
        return {
          label: 'Start Free Trial',
          disabled: false,
          action: 'signup' as PlanAction,
          variant: 'primary',
        };
      }
      return {
        label: plan.subscription_type === 'pay_per_course' ? 'Enquire Now' : 'Subscribe Now',
        disabled: false,
        action: 'signup' as PlanAction,
        variant: plan.subscription_type === 'pay_per_course' ? 'enterprise' : 'primary',
      };
    }

    if (plan.is_in_myorder !== null) {
      return {
        label: 'Already Subscribed',
        disabled: true,
        action: 'subscribe' as PlanAction,
        variant: 'disabled',
      };
    }
    if (plan.is_added_to_cart) {
      return {
        label: 'Added to Cart',
        disabled: false,
        action: 'subscribe' as PlanAction,
        variant: 'primary',
      };
    }
    if (plan.is_unlimited_trial_enabled) {
      return {
        label: 'Free Trial Activated',
        disabled: true,
        action: 'free-trial' as PlanAction,
        variant: 'disabled',
      };
    }
    return {
      label: 'Subscribe Now',
      disabled: false,
      action: 'subscribe' as PlanAction,
      variant: 'primary',
    };
  });

  readonly showFirmSponsorship = computed(() => {
    const plan = this.plan();
    return (
      plan.is_recommended &&
      !plan.is_firm_sponsorship_applied &&
      !plan.is_in_myorder &&
      !plan.is_added_to_cart
    );
  });

  readonly hasConditions = computed(() =>
    this.plan().features.some((f) => f.planfeature?.has_conditions),
  );

  readonly cardClasses = computed(() => {
    if (this.isRecommended()) return 'bg-linear-to-br from-plan-5/60 via-plan-2 to-plan-1 ';
    if (this.isEnterprise()) return 'bg-linear-to-tr from-[#1A2027] to-[#203144] from-50%';
    return 'bg-linear-to-tr from-[#1A2027] to-[#203144] from-50%';
  });

  onAction() {
    const config = this.buttonConfig();
    if (config.disabled) return;
    this.actionClicked.emit({ plan: this.plan(), action: config.action });
  }

  onFirmSponsorship() {
    this.actionClicked.emit({ plan: this.plan(), action: 'firm-sponsorship' });
  }
}
