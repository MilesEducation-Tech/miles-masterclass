import { Directive, ElementRef, inject, input, output, signal, computed } from '@angular/core';
import { HtmlToPdf } from '../services/html-to-pdf/html-to-pdf';
import { Logger } from '../services/logger/logger';
import type {
  PageSize,
  Orientation,
  PdfMargins,
  PdfExclude,
  PdfOptions,
} from '../services/html-to-pdf/html-to-pdf.model';

@Directive({
  selector: '[appHtmlToPdf]',
  exportAs: 'appHtmlToPdf',
  host: {
    '(click)': 'onTrigger($event, "click")',
    '(dblclick)': 'onTrigger($event, "dblclick")',
    '(mouseenter)': 'onTrigger($event, "mouseenter")',
  },
})
export class HtmlToPdfDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly pdfService = inject(HtmlToPdf);
  private readonly logger = inject(Logger);

  /** PDF filename */
  readonly pdfFilename = input('document.pdf');

  /** Page size */
  readonly pdfPageSize = input<PageSize>('A4');

  /** Page orientation */
  readonly pdfOrientation = input<Orientation>('portrait');

  /** Canvas render quality (higher = sharper, default 2) */
  readonly pdfQuality = input(2);

  /** Page margins in mm */
  readonly pdfMargins = input<PdfMargins | undefined>(undefined);

  /** Elements/classes/selectors to exclude from the PDF */
  readonly pdfExclude = input<PdfExclude | undefined>(undefined);

  /** DOM event that triggers generation ('click' | 'dblclick' | 'mouseenter' | 'none') */
  readonly pdfTriggerEvent = input<'click' | 'dblclick' | 'mouseenter' | 'none'>('click');

  /** Emits when PDF generation state changes */
  readonly pdfGenerating = output<boolean>();

  /** Emits when PDF generation completes */
  readonly pdfGenerated = output<void>();

  /** Emits when PDF generation fails */
  readonly pdfError = output<Error>();

  /** Whether a PDF is currently being generated */
  readonly generating = signal(false);

  /** Resolved options computed from all inputs */
  readonly options = computed<PdfOptions>(() => ({
    filename: this.pdfFilename(),
    pageSize: this.pdfPageSize(),
    orientation: this.pdfOrientation(),
    quality: this.pdfQuality(),
    margins: this.pdfMargins(),
    exclude: this.pdfExclude(),
  }));

  protected onTrigger(event: Event, eventType: string): void {
    if (this.pdfTriggerEvent() !== eventType) return;

    if (eventType === 'click' || eventType === 'dblclick') {
      event.preventDefault();
    }

    this.generatePdf();
  }

  async generatePdf(): Promise<void> {
    if (this.generating()) return;

    this.generating.set(true);
    this.pdfGenerating.emit(true);

    try {
      await this.pdfService.convertToPdf(this.el.nativeElement, this.options());
      this.pdfGenerated.emit();
    } catch (error) {
      this.pdfError.emit(error as Error);
      this.logger.error('PDF generation failed:', error);
    } finally {
      this.generating.set(false);
      this.pdfGenerating.emit(false);
    }
  }
}
