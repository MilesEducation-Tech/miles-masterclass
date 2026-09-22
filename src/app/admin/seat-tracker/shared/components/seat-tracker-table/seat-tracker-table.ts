import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRotateCw, lucideSend } from '@ng-icons/lucide';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { NotificationService } from '@core/services/notification/notification';
import { Seat, SeatStatus } from '@admin/partner-platform/shared/models/partner-platform.model';

interface StatusChip {
  label: string;
  bg: string;
  fg: string;
}

const STATUS_CHIPS: Record<SeatStatus, StatusChip> = {
  available: { label: 'Available', bg: 'var(--mm-info-bg)', fg: 'var(--mm-info-fg)' },
  shared: { label: 'Shared', bg: 'var(--mm-warn-bg)', fg: 'var(--mm-warn-fg)' },
  applied: { label: 'Applied', bg: 'var(--mm-success-bg)', fg: 'var(--mm-success-fg)' },
  expired: { label: 'Expired', bg: 'var(--mm-danger-bg)', fg: 'var(--mm-danger-fg)' },
};

@Component({
  selector: 'app-seat-tracker-table',
  imports: [CurrencyPipe, DatePipe, NgIcon, Button, Spinner],
  providers: [provideIcons({ lucideRotateCw, lucideSend })],
  templateUrl: './seat-tracker-table.html',
  styleUrl: './seat-tracker-table.css',
  host: { class: 'block w-full' },
})
export class SeatTrackerTable {
  private readonly notification = inject(NotificationService);

  readonly rows = input.required<Seat[]>();
  readonly isLoading = input<boolean>(false);
  /** Seat:send capability — shows the send column and resend buttons. */
  readonly sendEnabled = input<boolean>(false);
  /** Show the Firm column — true for network-wide / super views, false when pinned to one firm. */
  readonly showFirm = input<boolean>(false);
  readonly currentPage = input<number>(1);
  readonly pageSize = input<number>(20);
  readonly totalCount = input<number>(0);
  readonly hasNext = input<boolean>(false);
  readonly hasPrev = input<boolean>(false);

  readonly share = output<{ seat: Seat; email: string }>();
  readonly resend = output<Seat>();
  readonly prevPage = output<void>();
  readonly nextPage = output<void>();

  protected readonly canPrev = computed(() => this.hasPrev() && !this.isLoading());
  protected readonly canNext = computed(() => this.hasNext() && !this.isLoading());

  protected readonly pageWindow = computed(() => {
    const rowsLen = this.rows().length;
    const total = this.totalCount();
    if (rowsLen === 0) return { from: 0, to: 0, total };
    const from = (this.currentPage() - 1) * this.pageSize() + 1;
    const to = from + rowsLen - 1;
    return { from, to, total };
  });

  /** Per-row "Send to" input drafts, keyed by seat id. */
  private readonly emailDrafts = signal<Readonly<Record<number, string>>>({});

  protected emailDraft(row: Seat): string {
    return this.emailDrafts()[row.id] ?? '';
  }

  protected onDraftInput(row: Seat, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.emailDrafts.update((drafts) => ({ ...drafts, [row.id]: value }));
  }

  protected canSend(row: Seat): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.emailDraft(row).trim());
  }

  protected onSend(row: Seat): void {
    const email = this.emailDraft(row).trim();
    if (!email) {
      this.notification.info('Missing email', 'Type the email to send this seat to.');
      return;
    }
    this.share.emit({ seat: row, email });
    this.emailDrafts.update((drafts) => ({ ...drafts, [row.id]: '' }));
  }

  protected chip(status: SeatStatus): StatusChip {
    return STATUS_CHIPS[status];
  }

  /** Mask the local part of an email, e.g. "rahul.verma@x.com" -> "ra•••ma@x.com". */
  protected maskEmail(email: string | null): string {
    if (!email || !email.includes('@')) return email ?? '—';
    const at = email.lastIndexOf('@');
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    let masked: string;
    if (local.length <= 2) {
      masked = `${local[0] ?? ''}•••`;
    } else if (local.length <= 5) {
      masked = `${local[0]}•••${local[local.length - 1]}`;
    } else {
      masked = `${local.slice(0, 2)}•••${local.slice(-2)}`;
    }
    return `${masked}@${domain}`;
  }
}
