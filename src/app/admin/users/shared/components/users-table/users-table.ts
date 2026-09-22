import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldOff, lucideShieldCheck, lucideEye, lucideEyeOff } from '@ng-icons/lucide';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { PartnerPanelUser } from '@admin/partner-platform/shared/models/partner-platform.model';

@Component({
  selector: 'app-users-table',
  imports: [DecimalPipe, NgIcon, Button, Spinner],
  providers: [provideIcons({ lucideShieldOff, lucideShieldCheck, lucideEye, lucideEyeOff })],
  templateUrl: './users-table.html',
  styleUrl: './users-table.css',
  host: { class: 'block w-full' },
})
export class UsersTable {
  readonly rows = input.required<PartnerPanelUser[]>();
  readonly isLoading = input<boolean>(false);
  readonly currentPage = input<number>(1);
  readonly pageSize = input<number>(30);
  readonly totalCount = input<number>(0);
  readonly hasNext = input<boolean>(false);
  readonly hasPrev = input<boolean>(false);
  /**
   * Block/unblock visibility. The server honours the Django `user:block`
   * capability, not a Supabase perm — the page passes `me.can('user:block')`,
   * so the button never renders for an admin whose click would only 403.
   */
  readonly canBlock = input<boolean>(false);

  readonly blockToggle = output<PartnerPanelUser>();
  readonly prevPage = output<void>();
  readonly nextPage = output<void>();

  protected readonly canPrev = computed(() => this.hasPrev() && !this.isLoading());
  protected readonly canNext = computed(() => this.hasNext() && !this.isLoading());

  protected readonly pageWindow = computed(() => {
    const rowsLen = this.rows().length;
    const total = this.totalCount();
    if (rowsLen === 0) return { from: 0, to: 0, total };
    const from = (this.currentPage() - 1) * this.pageSize() + 1;
    return { from, to: from + rowsLen - 1, total };
  });

  protected onToggle(user: PartnerPanelUser): void {
    this.blockToggle.emit(user);
  }

  /**
   * Row ids whose email is currently shown in full. Emails render masked by
   * default for privacy; the admin can reveal one row at a time via the eye
   * toggle in the Email column.
   */
  private readonly revealedEmails = signal<ReadonlySet<number>>(new Set());

  protected isEmailRevealed(row: PartnerPanelUser): boolean {
    return this.revealedEmails().has(row.id);
  }

  protected toggleEmailReveal(row: PartnerPanelUser): void {
    this.revealedEmails.update((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }
      return next;
    });
  }

  /** Row ids whose phone number is currently shown in full. */
  private readonly revealedPhones = signal<ReadonlySet<number>>(new Set());

  protected isPhoneRevealed(row: PartnerPanelUser): boolean {
    return this.revealedPhones().has(row.id);
  }

  protected togglePhoneReveal(row: PartnerPanelUser): void {
    this.revealedPhones.update((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }
      return next;
    });
  }

  /** Whether the phone cell holds a maskable value (not empty / "N/A"). */
  protected hasPhone(row: PartnerPanelUser): boolean {
    return !!row.phone && row.phone !== 'N/A';
  }

  /** Mask the middle digits of a phone number, e.g. "2356897410" -> "23•••10". */
  protected maskPhone(phone: string): string {
    if (!phone || phone.length < 5) return phone;
    return `${phone.slice(0, 2)}•••${phone.slice(-2)}`;
  }

  /**
   * Mask the middle of the email's local part, keeping the domain visible
   * (the domain is the vendor-mapping context for this screen).
   * e.g. "manoj.hr.admin@mileseducation.com" -> "ma•••in@mileseducation.com"
   */
  protected maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
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
