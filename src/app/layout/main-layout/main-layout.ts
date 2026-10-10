import { Component, ElementRef, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Header } from '@layout/header/header';
import { Footer } from '@layout/footer/footer';
import { FooterOverlay } from '@layout/footer-overlay/footer-overlay';

@Component({
  selector: 'app-main-layout',
  imports: [Header, Footer, FooterOverlay, RouterOutlet, TranslocoPipe],
  templateUrl: './main-layout.html',
})
export class MainLayout {
  private readonly contentStart = viewChild.required<ElementRef<HTMLElement>>('contentStart');

  /** Skip link: moves keyboard focus past the header to the start of the page content. */
  protected skipToContent(): void {
    this.contentStart().nativeElement.focus();
  }
}
