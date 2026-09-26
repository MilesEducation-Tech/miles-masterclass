import { afterNextRender, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { injectDialogRef } from 'ng-primitives/dialog';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import { Logger } from '@core/services/logger/logger';
import { Button } from '../../ui/button/button';

export interface CalendlyDialogData {
  /** Accessible name for the dialog, e.g. "Schedule a demo". */
  ariaLabel?: string;
  /** Calendly scheduling URL, e.g. https://calendly.com/<user>/<event-type> */
  url: string;
  /** Show the close (X) button in the top-right corner. Defaults to true. */
  closeAction?: boolean;
  /** Optional prefill — https://help.calendly.com/hc/en-us/articles/360020052833 */
  prefill?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    customAnswers?: Record<string, string>;
  };
  /** Optional UTM params surfaced to Calendly */
  utm?: {
    utmCampaign?: string;
    utmSource?: string;
    utmMedium?: string;
    utmContent?: string;
    utmTerm?: string;
  };
}

interface CalendlyApi {
  initInlineWidget(options: {
    url: string;
    parentElement: HTMLElement;
    prefill?: CalendlyDialogData['prefill'];
    utm?: CalendlyDialogData['utm'];
  }): void;
}

declare global {
  interface Window {
    Calendly?: CalendlyApi;
  }
}

const CALENDLY_SCRIPT_SRC = 'https://assets.calendly.com/assets/external/widget.js';

@Component({
  selector: 'app-calendly-dialog',
  imports: [Button, DialogShell],
  templateUrl: './calendly-dialog.html',
  styleUrl: './calendly-dialog.css',
  host: { class: 'block' },
})
export class CalendlyDialog {
  private readonly dialogRef = injectDialogRef<CalendlyDialogData, boolean | undefined>();
  protected readonly data = this.dialogRef.data;

  readonly loadError = signal<string | null>(null);

  private readonly widgetEl = viewChild.required<ElementRef<HTMLDivElement>>('widget');
  private readonly logger = inject(Logger);

  constructor() {
    afterNextRender(() => {
      this.bootstrap().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load scheduler.';
        this.loadError.set(message);
        this.logger.error('[CalendlyDialog] failed to initialize', err);
      });
    });
  }

  close(confirmed = false): void {
    this.dialogRef.close(confirmed);
  }

  private async bootstrap(): Promise<void> {
    const host = this.widgetEl().nativeElement;
    if (!window.Calendly) {
      await loadScript(CALENDLY_SCRIPT_SRC);
    }
    if (!host.isConnected || !window.Calendly) return;

    window.Calendly.initInlineWidget({
      url: this.data.url,
      parentElement: host,
      prefill: this.data.prefill,
      utm: this.data.utm,
    });
  }
}

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) {
    return existing.dataset['loaded'] === 'true'
      ? Promise.resolve()
      : new Promise<void>((resolve, reject) => {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener(
            'error',
            () => reject(new Error(`Failed to load script: ${src}`)),
            { once: true },
          );
        });
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.addEventListener(
      'load',
      () => {
        script.dataset['loaded'] = 'true';
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      'error',
      () => {
        script.remove();
        reject(new Error(`Failed to load script: ${src}`));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });
}
