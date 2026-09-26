import type { OfferingData } from '@core/constants/offerings.config';
import type { PartnerContentItem } from '@shared/components/partner-content-list/partner-content-list';
import type { PlanPointer } from '@shared/components/plan-benefits/plan-benefits';

/** A run of heading text shown in a partner's brand colour. */
export interface BrandHighlight {
  text: string;
  /** Tailwind classes for the highlighted run, e.g. `text-[#f9bb16]`. */
  class: string;
}

/**
 * Everything that differs between the partner landing pages. `partner-landing` renders one of these;
 * each partner's lives in `data/<partner>.ts` and reaches the page through a route resolver, so it
 * stays in its own lazy chunk.
 */
export interface PartnerLandingConfig {
  /** The hero pill reads "<brand> Members Access". */
  pill: { brand: string; brandClass?: string };
  heroContent: PartnerContentItem[];

  /** Anchor of the tracks section below the hero. */
  contentSectionId: string;

  benefits: {
    /** The whole heading, or — with `highlight` — the text before the highlighted run. */
    heading: string;
    highlight?: BrandHighlight;
    /** Overrides `plan-benefits`' icon size. */
    iconClass?: string;
  };
  planPointers: PlanPointer[];
  /**
   * `society` members get the $599 offer copy and "Schedule Discovery Call";
   * `firm` members get the firm copy and "Activate Your Firm's Access".
   */
  audience: 'society' | 'firm';
  /**
   * CPA Canada drops the $599 price lines and shows only the closing sentence, as an `<h3>`.
   * Ignored for `firm`.
   */
  shortOffer?: boolean;

  offeringContent: PartnerContentItem[];
  offerings: OfferingData[];

  footerContent: PartnerContentItem[];
  /** Anchor of the enquiry section; the hero pill and the benefits CTA scroll here. */
  sectionId: string;
  enquiryType: string;
  /** Overrides the enquiry form's "keep me updated" label. */
  keepUpdatedLabel?: string;
}
