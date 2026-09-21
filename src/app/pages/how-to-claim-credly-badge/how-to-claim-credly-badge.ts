import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import {
  VideoListWrapper,
  type VideoListItem,
} from '../../features/partners/shared/components/video-list-wrapper/video-list-wrapper';

/**
 * Landing page explaining how to claim, verify and share the Miles Masterclass
 * Credly digital badge. The embedded step-by-step PDF swaps between a portrait
 * (mobile) and landscape (desktop) layout based on the active viewport.
 */
@Component({
  selector: 'app-how-to-claim-credly-badge',
  imports: [VideoListWrapper],
  templateUrl: './how-to-claim-credly-badge.html',
  styleUrl: './how-to-claim-credly-badge.css',
})
export class HowToClaimCredlyBadge implements OnInit {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly S3_BUCKET_URL = environment.S3_BUCKET_URL;

  /** Promo reel rendered by the shared partners video carousel. */
  protected readonly videoList: VideoListItem[] = [
    {
      videoSrc: `${this.S3_BUCKET_URL}static-assests/web-app/commons/howToClaimCredlyBadge.mp4`,
      posterSrc: `${this.S3_BUCKET_URL}static-assests/web-app/commons/howToClaimCredlyBadge.webp`,
    },
  ];

  /** Sanitized PDF URL bound to the iframe `src`. */
  protected readonly pdfUrl = signal<SafeResourceUrl>(
    this.sanitizer.bypassSecurityTrustResourceUrl(''),
  );

  ngOnInit(): void {
    this.updatePdfUrl();

    // Re-resolve the PDF whenever the viewport crosses a handset/tablet portrait
    // breakpoint, so mobile users get the portrait-optimised document.
    this.breakpointObserver
      .observe([Breakpoints.HandsetPortrait, Breakpoints.TabletPortrait])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updatePdfUrl());
  }

  private updatePdfUrl(): void {
    const isMobile = this.breakpointObserver.isMatched(Breakpoints.HandsetPortrait);
    const pdfFile = isMobile ? 'HowToClaimBadgeSm.pdf' : 'HowToClaimBadgeLg.pdf';

    const url = `${this.S3_BUCKET_URL}static-assests/web-app/caira/${pdfFile}`;

    this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
  }

  protected scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
