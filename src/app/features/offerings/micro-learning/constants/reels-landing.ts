import { FilterContentType } from '@core/models/masterclass-rail-filter.model';
import { PartnerContentItem } from '@shared/components/partner-content-list/partner-content-list';

/** `filter/`'s `content_type` for the reels rails: the filter lists reels only. */
export const REELS_FILTER_CONTENT_TYPE: FilterContentType = 'reel';

/** The URL segment of a reel's page (the API's course types are `nano_learning` / `micro_learning`). */
export const REELS_PATH_SEGMENT = 'micro-learning';

/** The section id of the Coming Soon rail on the reels page. */
export const REELS_COMING_SOON_SECTION_ID = 'reels-coming-soon';

/** The heading over the Coming Soon rail. */
export const REELS_COMING_SOON_HEADING: PartnerContentItem[] = [
  {
    subHeading: 'Coming Soon on Reels',
    paragraph: 'Hit the bell icon for updates and never miss a new CPE course drop!',
    subHeadingClass: 'text-white md:text-5xl text-3xl font-bold',
    itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto leading-relaxed',
    paragraphClass: 'text-white md:text-lg text-base font-normal mt-2',
  },
];
