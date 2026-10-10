import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { svglLinkedin, svglYoutube } from '@ng-icons/svgl';
import { appStoreIcon, googlePlayIcon, instagramIcon, logo } from '@core/constants/icon';
import { FooterLink, FooterSection } from '@core/models/footer.model';
import { Utils } from '@shared/services/utils';
import { Consent } from '@core/services/consent/consent';
import { NgpDialogManager } from 'ng-primitives/dialog';
// Type-only: the dialog loads with `import()` when opened (PROMPT.md §4.4).
import type { CalendlyDialogData } from '@shared/dialogs/calendly-dialog/calendly-dialog';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { LanguageContext } from '@core/services/language-context/language-context';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageSwitcher } from '../components/language-switcher/language-switcher';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, NgIcon, NgOptimizedImage, LanguageSwitcher, TranslocoPipe],
  templateUrl: './footer.html',
})
export class Footer {
  private readonly utils = inject(Utils);
  private readonly dialogs = inject(NgpDialogManager);
  // Exposed for the footer "Cookie settings" link (reopens the consent panel).
  protected readonly consent = inject(Consent);
  // The switcher only exists when this build offers more than one language (not production yet).
  protected readonly canSwitchLanguage = inject(LanguageContext).canSwitch;
  private readonly transloco = inject(TranslocoService);
  /**
   * Translates a key into the visitor's language. Brand and partner names (social, app stores,
   * partnerships) are deliberately NOT passed through it: they read the same in every language.
   */
  private readonly t = (key: string): string => this.transloco.translate(key);

  // The token-cookie boolean, so SSR renders the right links (same as the header).
  readonly isLoggedIn = inject(AuthSession).isAuthenticated;
  // ponytail: `user-details/` has no `is_beta_access`; trial-gated links stay
  // hidden until the web API reports it (open backend question).
  readonly hasTrailAccess = signal(false);

  // Base path for routes
  readonly basePath = computed(() => {
    const { country, profession } = this.utils.getRouteParams();
    return `/${country?.toLowerCase()}/${profession}`;
  });

  protected readonly logo = logo;
  protected readonly qrCodeUrl =
    'https://asset.milesmasterclass.com/media/web-app/home/qr-code-styling.png';
  protected readonly copyrightYear = new Date().getFullYear();

  // All links configuration
  readonly exploreLinks = computed<FooterLink[]>(() => [
    {
      label: this.t('footer.home'),
      route: `${this.basePath()}/home`,
      showWhen: 'not-authenticated',
    },
    { label: this.t('nav.masterClass'), route: `${this.basePath()}/masterclass` },
    { label: this.t('nav.webinar'), route: `${this.basePath()}/webinar` },
    {
      label: this.t('footer.microLearning'),
      route: `${this.basePath()}/micro-learning`,
    },
    { label: this.t('nav.podcast'), route: `${this.basePath()}/podcast` },
    { label: this.t('nav.courseLibrary'), route: `${this.basePath()}/library/course-library` },
    {
      label: this.t('nav.instructorLibrary'),
      route: `${this.basePath()}/library/instructor-library`,
    },
    { label: this.t('footer.badgeLibrary'), route: `${this.basePath()}/library/badge-library` },
    { label: this.t('footer.becomeInstructor'), action: 'bookDemo' },
    {
      label: this.t('nav.cpeTracker'),
      route: `${this.basePath()}/cpe-tracker`,
      showWhen: 'authenticated',
    },
    { label: this.t('nav.plan'), route: `${this.basePath()}/payment/plan` },
    // Blog lives at the top level (matches WordPress permalinks), so it is not
    // scoped under basePath like the rest.
    // { label: 'Blog', route: '/blog' },
  ]);

  readonly policyLinks = computed<FooterLink[]>(() => [
    {
      label: this.t('footer.paymentPolicy'),
      route: `${this.basePath()}/faq`,
      queryParams: { faq: '3' },
    },
    {
      label: this.t('footer.creditsPolicy'),
      route: `${this.basePath()}/faq`,
      queryParams: { faq: '2' },
    },
    {
      label: this.t('footer.credlyBadge'),
      route: `${this.basePath()}/how-to-claim-credly-badge`,
    },
  ]);

  readonly socialLinks: FooterLink[] = [
    {
      label: 'LinkedIn',
      url: 'https://www.linkedin.com/company/miles-masterclass',
      icon: svglLinkedin,
    },
    { label: 'YouTube', url: 'https://www.youtube.com/@MilesMasterclass', icon: svglYoutube },
    {
      label: 'Instagram',
      url: 'https://www.instagram.com/miles.masterclass/',
      icon: instagramIcon,
    },
  ];

  readonly appStoreLinks: FooterLink[] = [
    {
      label: 'App Store',
      url: 'https://apps.apple.com/in/app/miles-masterclass-ai-cpe/id6736642042',
      icon: appStoreIcon,
    },
    {
      label: 'Google Play',
      url: 'https://play.google.com/store/apps/details?id=com.miles.masterclass&hl=en',
      icon: googlePlayIcon,
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
    {
      label: 'CPA Canada',
      route: `${this.basePath()}/partners/cpacanada`,
    },
    // {
    //   label: 'Alabama Society of CPAs',
    //   route: `${this.basePath()}/partners/alabama-society-of-cpas`,
    // },
  ]);

  readonly legalLinks = computed<FooterLink[]>(() => [
    {
      label: this.t('footer.privacyPolicy'),
      route: `${this.basePath()}/privacy-policy`,
    },
    {
      label: this.t('footer.compliance'),
      route: `/compliance`,
    },
    {
      label: this.t('footer.termsOfService'),
      route: `${this.basePath()}/terms-of-service`,
    },
  ]);

  // Filtered links based on user state
  readonly visibleExploreLinks = computed(() =>
    this.exploreLinks().filter((link) => this.shouldShowLink(link)),
  );

  // The three link columns. Partnerships is `wide`: on phones it spans both columns and its
  // nine links run in two columns, which keeps the footer short.
  readonly linkSections = computed<FooterSection[]>(() => [
    { title: this.t('footer.explore'), links: this.visibleExploreLinks() },
    { title: this.t('footer.policies'), links: this.policyLinks() },
    { title: this.t('footer.partnerships'), links: this.partnershipLinks(), wide: true },
  ]);

  /** Dispatch for action-type links (e.g. "Become an Instructor" → Book a demo). */
  handleLinkAction(link: FooterLink): void {
    if (link.action === 'bookDemo') {
      this.openScheduler();
    }
  }

  /** Opens the Calendly scheduler — mirrors the header's "Book Demo" action. */
  async openScheduler(): Promise<void> {
    const { CalendlyDialog } = await import('@shared/dialogs/calendly-dialog/calendly-dialog');
    this.dialogs.open(CalendlyDialog, {
      data: {
        ariaLabel: this.t('common.scheduleDemo'),
        url: 'https://calendly.com/rohan-singhai-milesmasterclass/30min',
        closeAction: true,
      } satisfies CalendlyDialogData,
    });
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
