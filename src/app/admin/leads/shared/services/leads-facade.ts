import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  linkedSignal,
  PLATFORM_ID,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { Supabase } from '../../../../shared/core/services/supabase/supabase';
import { Logger } from '../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../shared/core/services/notification/notification';
import { withPreviousValue } from '../../../../shared/utils/with-previous-value';
import { FirmInquiry, LeadStatus, LeadStatusFilter } from '../models/firm-inquiry.model';

const TABLE = 'firm_inquiries';
const PAGE_SIZE = 10;
// ponytail: client-side CSV, capped — move to a server export endpoint if lead
// volume ever outgrows this.
const EXPORT_LIMIT = 5000;

const EXPORT_COLUMNS: { key: keyof FirmInquiry; label: string }[] = [
  { key: 'full_name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'firm_name', label: 'Firm' },
  { key: 'job_role', label: 'Job role' },
  { key: 'help_type', label: 'Help type' },
  { key: 'enquiry_type', label: 'Enquiry type' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
  { key: 'created_at', label: 'Created' },
];

function csvCell(value: unknown): string {
  const s = Array.isArray(value) ? value.join('; ') : value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Reads (and lightly mutates) the `firm_inquiries` lead table straight from
 * Supabase — these are Supabase tables, not the Django REST API. RLS already
 * gates SELECT by leads:read, UPDATE by leads:write. Mirrors the page-by-page
 * pattern of PartnerUsersFacade but talks to Supabase like AdminUsersFacade.
 */
@Injectable({ providedIn: 'root' })
export class LeadsFacade {
  private readonly supabase = inject(Supabase);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ---- Filter state --------------------------------------------------------

  readonly searchTerm = signal('');
  readonly statusFilter = signal<LeadStatusFilter>('all');
  readonly pageNumber = signal(1);

  // ---- Listing resource ----------------------------------------------------

  private readonly rawResource = resource({
    params: () => {
      if (!this.isBrowser) return undefined;
      return {
        page: this.pageNumber(),
        search: this.searchTerm(),
        status: this.statusFilter(),
      };
    },
    loader: async ({ params, abortSignal }) => {
      const client = await this.supabase.getClient();
      const from = (params.page - 1) * PAGE_SIZE;

      let q = client
        .from(TABLE)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
        .abortSignal(abortSignal);

      if (params.status !== 'all') q = q.eq('status', params.status);
      if (params.search) {
        const t = params.search;
        q = q.or(`full_name.ilike.%${t}%,email.ilike.%${t}%,firm_name.ilike.%${t}%`);
      }

      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as FirmInquiry[], total: count ?? 0 };
    },
  });

  private readonly leadsResource = withPreviousValue(this.rawResource);

  /** Local mirror so optimistic status patches survive stale-while-revalidate. */
  readonly rows = linkedSignal({
    source: this.leadsResource.snapshot,
    computation: (snap, previous): FirmInquiry[] => {
      if (snap.status !== 'resolved') return previous?.value ?? [];
      return snap.value?.rows ?? [];
    },
  });

  readonly totalCount = computed(() => this.leadsResource.value()?.total ?? 0);
  readonly currentPage = computed(() => this.pageNumber());
  readonly pageSize = PAGE_SIZE;
  readonly isLoading = computed(() => this.leadsResource.isLoading());
  readonly error = computed(() => this.leadsResource.error());
  readonly hasPrev = computed(() => this.pageNumber() > 1);
  readonly hasNext = computed(() => this.pageNumber() * PAGE_SIZE < this.totalCount());

  constructor() {
    // Reset to page 1 whenever the filters change — a result on page 3 with a
    // new filter would otherwise load stale rows.
    effect(() => {
      this.searchTerm();
      this.statusFilter();
      untracked(() => {
        if (this.pageNumber() !== 1) this.pageNumber.set(1);
      });
    });
  }

  // ---- Filter setters ------------------------------------------------------

  setSearch(value: string): void {
    this.searchTerm.set(value.trim());
  }

  setStatusFilter(value: LeadStatusFilter): void {
    this.statusFilter.set(value);
  }

  setPage(page: number): void {
    if (page < 1) return;
    this.pageNumber.set(page);
  }

  // ---- Status mutation (leads:write) ---------------------------------------

  async updateStatus(id: string, status: LeadStatus): Promise<void> {
    try {
      const client = await this.supabase.getClient();
      const { error } = await client
        .from(TABLE)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

      this.rows.update((rows) => rows.map((r) => (r.id === id ? { ...r, status } : r)));
      this.notification.success('Status updated', `Lead marked as ${status}.`);
    } catch (err) {
      this.logger.error('[LeadsFacade] updateStatus failed', err);
      this.notification.error(
        'Update failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  }

  // ---- CSV export (leads:export) -------------------------------------------

  async exportCsv(): Promise<void> {
    if (!this.isBrowser) return;
    try {
      const client = await this.supabase.getClient();
      let q = client
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(EXPORT_LIMIT);

      if (this.statusFilter() !== 'all') q = q.eq('status', this.statusFilter());
      if (this.searchTerm()) {
        const t = this.searchTerm();
        q = q.or(`full_name.ilike.%${t}%,email.ilike.%${t}%,firm_name.ilike.%${t}%`);
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as FirmInquiry[];
      if (!rows.length) {
        this.notification.info('Nothing to export', 'No leads match the current filter.');
        return;
      }

      const header = EXPORT_COLUMNS.map((c) => c.label).join(',');
      const body = rows
        .map((row) => EXPORT_COLUMNS.map((c) => csvCell(row[c.key])).join(','))
        .join('\n');
      this.download(`${header}\n${body}`, `leads-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      this.logger.error('[LeadsFacade] exportCsv failed', err);
      this.notification.error(
        'Export failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  }

  private download(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  reload(): void {
    this.rawResource.reload();
  }
}
