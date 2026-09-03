import { NgOptimizedImage } from '@angular/common';
import { Component, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { svglLinkedin, svglYoutube } from '@ng-icons/svgl';
import { appStoreIcon, googlePlayIcon, instagramIcon } from '../../shared/core/constant/icon';
import { FooterLink, FooterSection } from '../../shared/core/models/footer.model';
import { Utils } from '../../shared/core/services/utils/utils';
import { Auth } from '../../shared/core/services/auth/auth';
import { Consent } from '../../shared/core/services/consent/consent';
import { Dialog } from '../../shared/core/services/dialog/dialog';
import {
  CalendlyDialog,
  CalendlyDialogData,
} from '../../shared/components/dialog/calendly-dialog/calendly-dialog';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, NgIcon, NgOptimizedImage],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);
  private readonly auth = inject(Auth);
  private readonly dialog = inject(Dialog);
  // Exposed for the footer "Cookie settings" link (reopens the consent panel).
  protected readonly consent = inject(Consent);

  // User state (in real app, inject from a service)
  readonly userData = computed(() => this.auth.currentUser());

  // Computed properties for user state
  readonly isLoggedIn = computed(() => !!this.userData());
  readonly hasTrailAccess = computed(() => this.userData()?.is_beta_access ?? false);

  // Base path for routes
  readonly basePath = computed(() => {
    const { country, profession } = this.utils.getRouteParams();
    return `/${country?.toLowerCase()}/${profession}`;
  });

  // Icons mapping
  readonly icons = {
    svglLinkedin,
    svglYoutube,
    instagramIcon,
    appStoreIcon,
    googlePlayIcon,
  };

  // All links configuration
  readonly exploreLinks = computed<FooterLink[]>(() => [
    { label: 'Home', route: `${this.basePath()}/home`, showWhen: 'not-authenticated' },
    { label: 'Master Class', route: `${this.basePath()}/masterclass` },
    { label: 'Webinar', route: `${this.basePath()}/webinar` },
    {
      label: 'Micro Learning',
      route: `${this.basePath()}/micro-learning`,
    },
    { label: 'Podcast', route: `${this.basePath()}/podcast` },
    { label: 'Course Library', route: `${this.basePath()}/library/course-library` },
    { label: 'Instructor Library', route: `${this.basePath()}/library/instructor-library` },
    { label: 'Badge Library', route: `${this.basePath()}/library/badge-library` },
    { label: 'Become an Instructor', action: 'bookDemo' },
    { label: 'CPE Tracker', route: `${this.basePath()}/cpe-tracker`, showWhen: 'authenticated' },
    { label: 'Plan', route: `${this.basePath()}/payment/plan` },
    // Blog lives at the top level (matches WordPress permalinks), so it is not
    // scoped under basePath like the rest.
    // { label: 'Blog', route: '/blog' },
  ]);

  readonly policyLinks = computed<FooterLink[]>(() => [
    {
      label: 'Payment, Cancellation & Refund Policy',
      route: `${this.basePath()}/faq`,
      queryParams: { faq: '3' },
    },
    {
      label: 'Credits & Reporting Policy',
      route: `${this.basePath()}/faq`,
      queryParams: { faq: '2' },
    },
    {
      label: 'How to Claim Credly Badge',
      route: `${this.basePath()}/how-to-claim-credly-badge`,
    },
  ]);

  readonly socialLinks: FooterLink[] = [
    {
      label: 'LinkedIn',
      url: 'https://www.linkedin.com/company/miles-masterclass',
      icon: 'svglLinkedin',
    },
    { label: 'YouTube', url: 'https://www.youtube.com/@MilesMasterclass', icon: 'svglYoutube' },
    {
      label: 'Instagram',
      url: 'https://www.instagram.com/miles.masterclass/',
      icon: 'instagramIcon',
    },
  ];

  readonly appStoreLinks: FooterLink[] = [
    {
      label: 'App Store',
      url: 'https://apps.apple.com/in/app/miles-masterclass-ai-cpe/id6736642042',
      icon: 'appStoreIcon',
    },
    {
      label: 'Google Play',
      url: 'https://play.google.com/store/apps/details?id=com.miles.masterclass&hl=en',
      icon: 'googlePlayIcon',
    },
  ];

  readonly partnershipLinks = computed<FooterLink[]>(() => [
    {
      label: 'Boomer Knowledge Network',
      route: `${this.basePath()}/partners/boomer-knowledge-network`,
    },
    {
      label: 'Illinois Society of CPAs',
      route: `${this.basePath()}/partners/illinois-society-of-cpas`,
    },
    {
      label: 'Delaware Society of CPAs',
      route: `${this.basePath()}/partners/delaware-society-of-cpas`,
    },
    {
      label: 'Connecticut Society of CPAs',
      route: `${this.basePath()}/partners/connecticut-society-of-cpas`,
    },
    {
      label: 'Hawaii Society of CPAs',
      route: `${this.basePath()}/partners/hawaii-society-of-cpas`,
    },
    {
      label: 'MGI Worldwide',
      route: `${this.basePath()}/partners/mgi-world`,
    },
    {
      label: 'MGI North America',
      route: `${this.basePath()}/partners/mgi-north-america`,
    },
    {
      label: 'Allinial Global',
      route: `${this.basePath()}/partners/allinial-global`,
    },
    // {
    //   label: 'Alabama Society of CPAs',
    //   route: `${this.basePath()}/partners/alabama-society-of-cpas`,
    // },
  ]);

  readonly legalLinks = computed<FooterLink[]>(() => [
    {
      label: 'Privacy Policy',
      route: `${this.basePath()}/privacy-policy`,
    },
    {
      label: 'Compliance',
      route: `/compliance`,
    },
    {
      label: 'Terms of Service',
      route: `${this.basePath()}/terms-of-service`,
    },
  ]);

  // Filtered links based on user state
  readonly visibleExploreLinks = computed(() =>
    this.exploreLinks().filter((link) => this.shouldShowLink(link)),
  );

  // Dynamic footer sections for grid
  readonly footerSections = computed<FooterSection[]>(() => [
    { title: 'Explore', links: this.visibleExploreLinks(), type: 'links' },
    { title: 'Policies', links: this.policyLinks(), type: 'links' },
    { title: 'Partnerships', links: this.partnershipLinks(), type: 'links' },
    {
      title: 'Download App',
      links: this.appStoreLinks,
      type: 'download-app',
      qrCodeUrl: 'https://asset.milesmasterclass.com/media/web-app/home/qr-code-styling.png',
      colSpan: 2,
    },
  ]);

  // Static mapping for grid columns (Tailwind JIT requires static class names)
  private readonly gridColsMap: Record<number, string> = {
    1: 'xl:grid-cols-1',
    2: 'xl:grid-cols-2',
    3: 'xl:grid-cols-3',
    4: 'xl:grid-cols-4',
    5: 'xl:grid-cols-5',
    6: 'xl:grid-cols-6',
  };

  // Calculate total columns accounting for colSpan
  readonly gridColumnsClass = computed(() => {
    const totalCols = this.footerSections().reduce(
      (sum, section) => sum + (section.colSpan ?? 1),
      0,
    );
    return this.gridColsMap[totalCols] ?? 'xl:grid-cols-4';
  });

  navigateTo(path: string, queryParams?: Record<string, any>): void {
    this.router.navigate([path], { queryParams });
  }

  /** Dispatch for action-type links (e.g. "Become an Instructor" → Book a demo). */
  handleLinkAction(link: FooterLink): void {
    if (link.action === 'bookDemo') {
      this.openScheduler();
    }
  }

  /** Opens the Calendly scheduler — mirrors the header's "Book Demo" action. */
  openScheduler(): void {
    this.dialog.open<CalendlyDialog, boolean>(CalendlyDialog, {
      width: 'min(95vw, 760px)',
      ariaLabel: 'Schedule a demo',
      data: {
        url: 'https://calendly.com/rohan-singhai-milesmasterclass/30min',
        closeAction: true,
      } satisfies CalendlyDialogData,
    });
  }

  getIcon(iconName: string): any {
    return this.icons[iconName as keyof typeof this.icons];
  }

  private shouldShowLink(link: FooterLink): boolean {
    switch (link.showWhen) {
      case 'authenticated':
        return this.isLoggedIn();
      case 'not-authenticated':
        return !this.isLoggedIn();
      case 'trail-access':
        return this.hasTrailAccess();
      default:
        return true;
    }
  }
}
