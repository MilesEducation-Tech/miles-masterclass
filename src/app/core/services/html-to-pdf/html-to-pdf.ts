import { inject, Service, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Logger } from '../logger/logger';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  PdfOptions,
  ResolvedPdfOptions,
  PdfExclude,
  BatchPdfItem,
  PdfLifecycleHooks,
  autoPageFormatMm,
} from './html-to-pdf.model';

@Service()
export class HtmlToPdf {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly logger = inject(Logger);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly generating = signal(false);
  readonly generatedCount = signal(0);
  readonly ready = computed(() => this.isBrowser && !this.generating());

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async convertToPdf(element: HTMLElement, options: PdfOptions = {}): Promise<void> {
    if (!this.isBrowser) {
      throw new Error('PDF generation is only available in browser environments');
    }

    if (this.generating()) {
      throw new Error('PDF generation already in progress');
    }

    this.generating.set(true);

    let offscreenHost: HTMLDivElement | null = null;

    try {
      const opts = this.resolveOptions(options);

      // 1. Create offscreen host — fixed, off-screen, 1280px wide like the old platform
      offscreenHost = document.createElement('div');
      offscreenHost.setAttribute('aria-hidden', 'true');
      Object.assign(offscreenHost.style, {
        position: 'fixed',
        left: '-10000px',
        top: '0',
        width: '1280px',
        overflow: 'visible',
        zIndex: '-1',
        pointerEvents: 'none',
        boxSizing: 'border-box',
      });

      // 3. Deep-clone the element into the offscreen host
      const clone = element.cloneNode(true) as HTMLElement;

      // Clone fills the 1280px host, bg-cover, natural height flow
      Object.assign(clone.style, {
        width: '1280px',
        minWidth: '1280px',
        maxWidth: '1280px',
        minHeight: '0',
        height: 'auto',
        maxHeight: 'none',
        overflow: 'visible',
        margin: '0',
        boxSizing: 'border-box',
        backgroundSize: 'cover',
      });

      // 4. Apply exclusions on the clone (live DOM untouched)
      this.applyExclusions(clone, opts.exclude);

      // 5. Convert all images to inline base64 data URLs on the clone
      //    so html2canvas never re-fetches them (avoids CORS entirely)
      await this.inlineImagesToBase64(element, clone);

      offscreenHost.appendChild(clone);
      document.body.appendChild(offscreenHost);

      // 6. Wait for browser to reflow the clone at 1280px width
      await this.nextFrame();

      // 7. Capture the offscreen clone — no CORS needed, all images are data URLs
      const canvas = await html2canvas(clone, {
        useCORS: false,
        allowTaint: false,
        scale: opts.quality,
        backgroundColor: null,
      });

      // Must be read while still attached — a detached element reports offsetWidth 0
      const captureWidthPx = clone.offsetWidth;

      // 8. Remove the offscreen host immediately
      document.body.removeChild(offscreenHost);
      offscreenHost = null;

      // 9. Build PDF — image fits page width exactly, aspect ratio preserved.
      //    'Auto' derives a custom page from the capture itself: content width at
      //    96 DPI, height from the aspect ratio. One page, no slicing, no dead space.
      const pdf =
        opts.pageSize === 'Auto'
          ? new jsPDF({
              orientation: canvas.height > canvas.width ? 'p' : 'l',
              unit: 'mm',
              format: autoPageFormatMm(captureWidthPx, canvas.width, canvas.height, opts.margins),
            })
          : new jsPDF(
              opts.orientation === 'landscape' ? 'l' : 'p',
              'mm',
              opts.pageSize.toLowerCase() as 'a4' | 'letter' | 'legal',
            );

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // JPEG at 0.92 quality ≈ visually identical to PNG but ~10-20x smaller
      const imgFormat = 'JPEG';
      const imgData = canvas.toDataURL('image/jpeg', opts.imageQuality);

      const imgWidth = pdfWidth - opts.margins.left - opts.margins.right;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const usableH = pdfHeight - opts.margins.top - opts.margins.bottom;

      // Auto is single-page by construction — never let float drift add a sliver page
      if (opts.pageSize === 'Auto' || imgHeight <= usableH) {
        // Single page
        pdf.addImage(imgData, imgFormat, opts.margins.left, opts.margins.top, imgWidth, imgHeight);
      } else {
        // Multi-page — slice canvas into page-height strips
        const totalPages = Math.ceil(imgHeight / usableH);

        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage();

          const srcY = Math.round(((page * usableH) / imgHeight) * canvas.height);
          const srcH = Math.round((usableH / imgHeight) * canvas.height);
          const actualSrcH = Math.min(srcH, canvas.height - srcY);

          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = actualSrcH;

          const ctx = pageCanvas.getContext('2d')!;
          ctx.drawImage(canvas, 0, srcY, canvas.width, actualSrcH, 0, 0, canvas.width, actualSrcH);

          const sliceH = (actualSrcH * imgWidth) / canvas.width;
          pdf.addImage(
            pageCanvas.toDataURL('image/jpeg', opts.imageQuality),
            imgFormat,
            opts.margins.left,
            opts.margins.top,
            imgWidth,
            sliceH,
          );
        }
      }

      // 10. Download
      pdf.save(opts.filename);
      this.generatedCount.update((c) => c + 1);
    } finally {
      // Safety net — always clean up
      if (offscreenHost?.parentNode) {
        document.body.removeChild(offscreenHost);
      }
      this.generating.set(false);
    }
  }

  async downloadElementAsPdf(elementId: string, options: PdfOptions = {}): Promise<void> {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id "${elementId}" not found`);
    }
    await this.convertToPdf(element, options);
  }

  async batchConvertToPdf(items: BatchPdfItem[]): Promise<void> {
    for (const item of items) {
      const element =
        typeof item.element === 'string' ? document.getElementById(item.element) : item.element;

      if (!element) {
        this.logger.warn('Element not found, skipping batch item');
        continue;
      }

      await this.convertToPdf(element, item.options);
    }
  }

  async generatePdfWithHooks(
    element: HTMLElement,
    options: PdfOptions = {},
    hooks?: PdfLifecycleHooks,
  ): Promise<void> {
    try {
      await hooks?.beforeGenerate?.();
      await this.convertToPdf(element, options);
      await hooks?.afterGenerate?.();
    } catch (error) {
      if (hooks?.onError) {
        hooks.onError(error as Error);
      } else {
        throw error;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Replace every <img> src in the clone with a base64 data URL.
   *
   * How it works:
   * 1. Collect all <img> elements from the ORIGINAL (already loaded, pixels in memory)
   * 2. Draw each original image onto a temporary canvas → toDataURL()
   * 3. Set the data URL on the matching CLONE <img>
   *
   * Because the original <img> was loaded WITHOUT crossOrigin attribute,
   * the browser rendered it fine. Drawing it to a canvas and exporting
   * works as long as we use the already-loaded element directly.
   *
   * This completely bypasses CORS — html2canvas never re-fetches anything.
   */
  private async inlineImagesToBase64(original: HTMLElement, clone: HTMLElement): Promise<void> {
    const originalImgs = original.querySelectorAll('img');
    const cloneImgs = clone.querySelectorAll('img');

    const promises = Array.from(originalImgs).map(async (origImg, i) => {
      const cloneImg = cloneImgs[i];
      if (!cloneImg) return;

      // NgOptimizedImage leaves a `srcset` on the clone, which wins over `src` —
      // html2canvas would re-fetch the CDN original and drop it on CORS taint.
      cloneImg.removeAttribute('srcset');
      cloneImg.removeAttribute('sizes');
      cloneImg.removeAttribute('loading');

      // Skip images that are already data URLs or empty
      if (!origImg.src || origImg.src.startsWith('data:')) return;

      // Skip images that haven't loaded yet
      if (!origImg.complete || origImg.naturalWidth === 0) return;

      try {
        const dataUrl = this.imgToDataUrl(origImg);
        cloneImg.src = dataUrl;
      } catch {
        // Fallback: try fetching the image as a blob (works for same-origin)
        try {
          const dataUrl = await this.fetchImgAsDataUrl(origImg.src);
          cloneImg.src = dataUrl;
        } catch {
          // Image cannot be converted — html2canvas will handle it as-is
          this.logger.warn(`Could not inline image: ${origImg.src}`);
        }
      }
    });

    await Promise.all(promises);
  }

  /**
   * Draw an already-loaded <img> element onto a canvas and export as data URL.
   * Works because the img was loaded without crossOrigin (no taint from the img tag itself).
   */
  private imgToDataUrl(img: HTMLImageElement): string {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    return canvas.toDataURL('image/png');
  }

  /**
   * Fetch an image URL as a blob and convert to a data URL.
   * Works for same-origin and CORS-enabled images.
   */
  private async fetchImgAsDataUrl(url: string): Promise<string> {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    const blob = await response.blob();

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /** Hide excluded elements directly on the clone — live DOM untouched */
  private applyExclusions(clone: HTMLElement, exclude: PdfExclude): void {
    const selectors: string[] = [];

    if (exclude.ids?.length) selectors.push(...exclude.ids.map((id) => `#${id}`));
    if (exclude.classes?.length) selectors.push(...exclude.classes.map((cls) => `.${cls}`));
    if (exclude.selectors?.length) selectors.push(...exclude.selectors);

    if (!selectors.length) return;

    const combined = selectors.join(', ');
    clone.querySelectorAll(combined).forEach((el) => {
      (el as HTMLElement).style.setProperty('display', 'none', 'important');
    });
  }

  private resolveOptions(options: PdfOptions): ResolvedPdfOptions {
    return {
      filename: options.filename ?? 'document.pdf',
      pageSize: options.pageSize ?? 'A4',
      orientation: options.orientation ?? 'portrait',
      margins: {
        top: options.margins?.top ?? 0,
        right: options.margins?.right ?? 0,
        bottom: options.margins?.bottom ?? 0,
        left: options.margins?.left ?? 0,
      },
      quality: options.quality ?? 2,
      imageQuality: options.imageQuality ?? 1,
      exclude: options.exclude ?? {},
      autoDownload: options.autoDownload ?? true,
    };
  }

  /** Wait for the next animation frame + microtask so the browser reflows */
  private nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }
}
