import { Component, inject, input } from '@angular/core';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { environment } from '@env/environment';
import { ScrollService } from '@core/services/scroll/scroll';
import { PartnerContentList } from '@shared/components/partner-content-list/partner-content-list';
import { PlanBenefits } from '@shared/components/plan-benefits/plan-benefits';
import { EnquiryForm } from '@shared/components/enquiry-form/enquiry-form';
import { VideoListWrapper } from '@shared/components/video-list-wrapper/video-list-wrapper';
import { Button } from '@shared/ui/button/button';
// Type-only: the dialog loads with `import()` when opened (PROMPT.md §4.4).
import type { CalendlyDialogData } from '@shared/dialogs/calendly-dialog/calendly-dialog';
import { ForPartnershipTabs } from '../../components/for-partnership-tabs/for-partnership-tabs';
import {
  PartnershipContent,
  PartnershipContentInput,
} from '../../components/partnership-content/partnership-content';
import type { PartnerShowcaseConfig } from '../../models/partner-showcase.model';

const S3_BUCKET_URL = environment.S3_BUCKET_URL;

/**
 * The long-form partner page (corporate, BKN, Illinois). The route resolves the partner's
 * `PartnerShowcaseConfig` from `data/<partner>.ts` and binds it to `partner`.
 */
@Component({
  selector: 'app-partner-showcase',
  imports: [
    PartnerContentList,
    Button,
    VideoListWrapper,
    ForPartnershipTabs,
    PartnershipContent,
    PlanBenefits,
    EnquiryForm,
  ],
  templateUrl: './partner-showcase.html',
})
export class PartnerShowcase {
  readonly partner = input.required<PartnerShowcaseConfig>();

  private readonly dialogs = inject(NgpDialogManager);
  private readonly scrollService = inject(ScrollService);

  protected readonly partnershipContent: PartnershipContentInput[] = [
    {
      type: 'MASTERCLASS',
      heading: 'Cinematic Master Classes',
      subheading: 'Long-form lessons from the world’s best, made to binge.',
    },
    {
      type: 'PODCAST',
      heading: 'On-the-Go Podcasts',
      subheading: 'Sharpen your edge between calls, commutes, and coffee runs.',
    },
    {
      type: 'MICRO-LEARNING',
      heading: 'Micro-Learning Bursts',
      subheading: 'Bite-sized lessons that fit any calendar.',
    },
  ];

  protected readonly videoList = [
    {
      videoSrc: `${S3_BUCKET_URL}static-assests/web-app/partners/masterclass-promo-sm1.mp4`,
      posterSrc: `${S3_BUCKET_URL}static-assests/web-app/partners/masterclass-promo.webp`,
      mobileVideoSrc: `${S3_BUCKET_URL}static-assests/web-app/home/hero-bg-mob.mp4`,
      mobilePosterSrc: `${S3_BUCKET_URL}static-assests/web-app/home/home-hero-sm.webp`,
    },
    {
      videoSrc: `${S3_BUCKET_URL}static-assests/web-app/partners/gary-boomer-sm1.mp4`,
      posterSrc: `${S3_BUCKET_URL}static-assests/web-app/partners/gary-boomer.webp`,
    },
    {
      videoSrc: `${S3_BUCKET_URL}static-assests/web-app/partners/jeff-sm1.mp4`,
      posterSrc: `${S3_BUCKET_URL}static-assests/web-app/partners/jeff.webp`,
    },
    {
      videoSrc: `${S3_BUCKET_URL}static-assests/web-app/partners/ellen-sm1.mp4`,
      posterSrc: `${S3_BUCKET_URL}static-assests/web-app/partners/ellen.webp`,
    },
    {
      videoSrc: `${S3_BUCKET_URL}static-assests/web-app/partners/scott-sm1.mp4`,
      posterSrc: `${S3_BUCKET_URL}static-assests/web-app/partners/scott.webp`,
    },
  ];

  protected scrollTo(id: string): void {
    this.scrollService.scrollToId(id, { offset: 96 });
  }

  protected async openScheduler(): Promise<void> {
    const { CalendlyDialog } = await import('@shared/dialogs/calendly-dialog/calendly-dialog');
    this.dialogs.open(CalendlyDialog, {
      data: {
        ariaLabel: 'Schedule a demo',
        url: 'https://calendly.com/rohan-singhai-milesmasterclass/30min',
        closeAction: true,
      } satisfies CalendlyDialogData,
    });
  }
}
