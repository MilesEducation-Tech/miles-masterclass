import { Component, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { environment } from '@env/environment';
import { ScrollService } from '@core/services/scroll/scroll';
import { PlanBenefits } from '@shared/components/plan-benefits/plan-benefits';
import { PartnerContentList } from '@shared/components/partner-content-list/partner-content-list';
import { Offering } from '@shared/components/offerings/offerings';
import { EnquiryForm } from '@shared/components/enquiry-form/enquiry-form';
import { Button } from '@shared/ui/button/button';
import { VideoListWrapper } from '@shared/components/video-list-wrapper/video-list-wrapper';
import {
  PartnershipContent,
  PartnershipContentInput,
} from '../../components/partnership-content/partnership-content';
import type { PartnerLandingConfig } from '../../models/partner-landing.model';

const S3_BUCKET_URL = environment.S3_BUCKET_URL;

/**
 * The partner landing page. One component renders every partner: the route resolves the partner's
 * `PartnerLandingConfig` from `data/<partner>.ts` and binds it to `partner`.
 */
@Component({
  selector: 'app-partner-landing',
  imports: [
    PartnerContentList,
    Offering,
    EnquiryForm,
    Button,
    PlanBenefits,
    PartnershipContent,
    VideoListWrapper,
    NgTemplateOutlet,
  ],
  templateUrl: './partner-landing.html',
})
export class PartnerLanding {
  readonly partner = input.required<PartnerLandingConfig>();

  private readonly scrollService = inject(ScrollService);

  protected readonly videoList = [
    {
      videoSrc: `${S3_BUCKET_URL}static-assests/web-app/partners/masterclass-promo-sm1.mp4`,
      posterSrc: `${S3_BUCKET_URL}static-assests/web-app/partners/masterclass-promo.webp`,
      // Portrait-friendly source for the aspect-9/16 mobile container —
      // the desktop promo is 16:9 and gets cropped badly on phones.
      mobileVideoSrc: `${S3_BUCKET_URL}static-assests/web-app/home/hero-bg-mob.mp4`,
      mobilePosterSrc: `${S3_BUCKET_URL}static-assests/web-app/home/home-hero-sm.webp`,
    },
  ];

  protected readonly partnershipContent: PartnershipContentInput[] = [
    {
      type: 'TRACKS',
      heading: null,
    },
  ];

  protected scrollTo(id: string): void {
    this.scrollService.scrollToId(id, { offset: 96 });
  }
}
