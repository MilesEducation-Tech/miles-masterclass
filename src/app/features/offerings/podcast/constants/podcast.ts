import { FilterContentType } from '@core/models/masterclass-rail-filter.model';
import { RecordDiskConfig } from '@shared/components/record-disk/record-disk';
import { PartnerContentItem } from '@shared/components/partner-content-list/partner-content-list';

/** `filter/`'s `content_type` for the podcast rails: the filter lists podcasts only. */
export const PODCAST_FILTER_CONTENT_TYPE: FilterContentType = 'podcast';

/** The section id of the Coming Soon rail on the podcast page. */
export const PODCAST_COMING_SOON_SECTION_ID = 'podcast-coming-soon';

/** The heading over the Coming Soon rail. */
export const PODCAST_COMING_SOON_HEADING: PartnerContentItem[] = [
  {
    subHeading: 'Coming Soon on Podcast',
    paragraph: 'Hit the bell icon for updates and never miss a new CPE course drop!',
    subHeadingClass: 'text-white md:text-5xl text-3xl font-bold',
    itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto leading-relaxed',
    paragraphClass: 'text-white md:text-lg text-base font-normal mt-2',
  },
];

/** The card's record disk: it slides out and spins while the card is hovered. */
export const PODCAST_RECORD_DISK: Omit<RecordDiskConfig, 'animate'> = {
  direction: 'right',
  slideOutPercent: 45,
  spinDuration: '3.5s',
};
