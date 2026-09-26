import type { PartnerContentItem } from '@shared/components/partner-content-list/partner-content-list';
import type { PlanPointer } from '@shared/components/plan-benefits/plan-benefits';
import type { PartnershipTab } from '../components/for-partnership-tabs/for-partnership-tabs';

/**
 * Everything that differs between the partner showcase pages (corporate, BKN, Illinois): long-form
 * pages with partnership tabs, as opposed to the member-access pages `PartnerLandingConfig`
 * describes. Each partner's config lives in `data/<partner>.ts` and reaches `partner-showcase` through
 * a route resolver.
 */
export interface PartnerShowcaseConfig {
  /**
   * A full-screen hero over two blurred glows, with "Explore Courses" (→ `contentSectionId`) and
   * "Schedule Discovery Call" (→ `sectionId`). Without it the compliance block opens the page and
   * carries "Book Demo" (→ `sectionId`) and a "Schedule Discovery Call" that opens the scheduler.
   */
  hero?: {
    content: PartnerContentItem[];
    /** The second glow's gradient, e.g. `bg-[radial-gradient(circle,#AB8862_30%,transparent_80%)]`. */
    glowClass: string;
  };
  complianceContent: PartnerContentItem[];

  partnershipMeansContent: PartnerContentItem[];
  partnershipTabs: PartnershipTab[];
  selectedTab: string;

  /** A plan-benefits block with the partner's own offer (Illinois). */
  benefits?: {
    heading: string;
    planPointers: PlanPointer[];
    /** Renders as "<lead> **<highlight>**", then each line after a line break. */
    offer: { lead: string; highlight: string; lines: string[] };
  };

  sampleContent: PartnerContentItem[];
  /** Anchor of the sample-content section. */
  contentSectionId: string;

  footerContent: PartnerContentItem[];
  /** Anchor of the enquiry section. */
  sectionId: string;
  enquiryType: string;
  /** The "OR" copy above "Book a Strategy Call" under the form. Without it that block is omitted. */
  orContent?: PartnerContentItem[];
}
