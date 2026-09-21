import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronRight } from '@ng-icons/lucide';
import { AriaInput } from '../../shared/components/ui/aria/aria-input/aria-input';
import { Button } from '../../shared/components/ui/button/button';
import { Spinner } from '../../shared/components/ui/spinner/spinner';
import { TabStrip } from '../../shared/components/ui/tab-strip/tab-strip';
import { Supabase } from '../../shared/core/services/supabase/supabase';
import { withPreviousValue } from '../../shared/utils/with-previous-value';
import {
  AUDIT_CATEGORY_LABELS,
  AuditCategory,
  AuditLogRow,
} from '../../shared/core/models/admin/audit-log.model';

const TABLE = 'admin_audit_log';
const PAGE_SIZE = 50;

type CategoryFilter = 'all' | AuditCategory;

const CATEGORY_TABS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mutation', label: AUDIT_CATEGORY_LABELS.mutation },
  { value: 'api', label: AUDIT_CATEGORY_LABELS.api },
  { value: 'auth', label: AUDIT_CATEGORY_LABELS.auth },
  { value: 'export', label: AUDIT_CATEGORY_LABELS.export },
  { value: 'navigation', label: AUDIT_CATEGORY_LABELS.navigation },
];

/** One line of a row's `changed` payload, rendered in the expanded panel. */
interface ChangeLine {
  key: string;
  before: string | null;
  after: string;
}

function fmt(value: unknown): string {
  if (value === null || value === undefined) return '—';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * `/admin/audit-log` — the read side of the admin audit trail.
 *
 * Reads Supabase directly: this is a Supabase table, so RLS is the boundary.
 * The `audit:read` policy means an admin without the permission gets zero rows
 * even if they reach this component, and the route guard stops them first.
 *
 * Component-owned `resource()`, no facade, per the house preference for new
 * feature work — no state here is shared with another page.
 */
@Component({
  selector: 'app-admin-audit-log',
  imports: [DatePipe, AriaInput, Button, Spinner, TabStrip, NgIcon],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight })],
  templateUrl: './audit-log.html',
  host: { class: 'block w-full' },
})
export class AuditLogPage {
  private readonly supabase = inject(Supabase);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly categoryTabs = CATEGORY_TABS;
  protected readonly tabLabels = CATEGORY_TABS.map((t) => t.label);

  /** Raw search box — debounced before it reaches the resource. */
  protected readonly searchInput = signal('');
  protected readonly searchTerm = signal('');
  protected readonly category = signal<CategoryFilter>('all');
  protected readonly fromDate = signal('');
  protected readonly toDate = signal('');

  /**
   * Keyset pagination, not offset. This table is never pruned, so `offset`
   * would degrade as it grows; `id < cursor` stays constant-time. The stack
   * holds the cursor of each page walked past, so "Newer" is a pop.
   */
  private readonly cursorStack = linkedSignal<string, number[]>({
    source: () => `${this.searchTerm()}|${this.category()}|${this.fromDate()}|${this.toDate()}`,
    computation: () => [],
  });
  private readonly cursor = computed(() => this.cursorStack().at(-1) ?? null);

  constructor() {
    toObservable(this.searchInput)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.searchTerm.set(value.trim()));
  }

  private readonly rawResource = resource({
    params: () => {
      if (!this.isBrowser) return undefined;
      return {
        cursor: this.cursor(),
        search: this.searchTerm(),
        category: this.category(),
        from: this.fromDate(),
        to: this.toDate(),
      };
    },
    loader: async ({ params, abortSignal }) => {
      const client = await this.supabase.getClient();

      let q = client
        .from(TABLE)
        .select('*')
        .order('id', { ascending: false })
        .limit(PAGE_SIZE)
        .abortSignal(abortSignal);

      if (params.cursor !== null) q = q.lt('id', params.cursor);
      if (params.category !== 'all') q = q.eq('category', params.category);
      if (params.from) q = q.gte('occurred_at', params.from);
      // `to` is a date; include the whole day rather than stopping at midnight.
      if (params.to) q = q.lt('occurred_at', `${params.to}T23:59:59.999Z`);

      if (params.search) {
        // Strip the characters that terminate a PostgREST `or()` list — an
        // unescaped comma or paren would rewrite the filter rather than be
        // matched literally.
        const t = params.search.replace(/[,()*]/g, ' ').trim();
        if (t) {
          q = q.or(
            `actor_email.ilike.%${t}%,entity_type.ilike.%${t}%,entity_id.ilike.%${t}%,action.ilike.%${t}%`,
          );
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditLogRow[];
    },
  });

  private readonly listResource = withPreviousValue(this.rawResource);

  protected readonly rows = computed(() => this.listResource.value() ?? []);
  protected readonly isLoading = computed(() => this.listResource.isLoading());
  protected readonly error = computed(() => {
    const err = this.listResource.error();
    if (!err) return null;
    return err instanceof Error ? err.message : 'Failed to load the audit log.';
  });

  protected readonly hasNewer = computed(() => this.cursorStack().length > 0);
  /** A full page back means there is probably another one behind it. */
  protected readonly hasOlder = computed(() => this.rows().length === PAGE_SIZE);

  protected readonly activeTabLabel = computed(
    () => CATEGORY_TABS.find((t) => t.value === this.category())?.label ?? null,
  );

  protected onTabChange(label: string): void {
    const tab = CATEGORY_TABS.find((t) => t.label === label);
    if (tab) this.category.set(tab.value);
  }

  protected goOlder(): void {
    const last = this.rows().at(-1)?.id;
    if (last !== undefined) this.cursorStack.update((s) => [...s, last]);
  }

  protected goNewer(): void {
    this.cursorStack.update((s) => s.slice(0, -1));
  }

  protected reload(): void {
    this.rawResource.reload();
  }

  // ---- row detail ----------------------------------------------------------

  private readonly expandedIds = signal<ReadonlySet<number>>(new Set());

  protected isExpanded(id: number): boolean {
    return this.expandedIds().has(id);
  }

  protected toggleExpand(id: number): void {
    this.expandedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * Updates arrive as `{column: {old, new}}`; inserts, deletes and client
   * payloads as a flat object. Render both without making the caller care.
   */
  protected changeLines(row: AuditLogRow): ChangeLine[] {
    const changed = row.changed;
    if (!changed) return [];
    return Object.entries(changed).map(([key, value]) => {
      const isDiff =
        !!value && typeof value === 'object' && !Array.isArray(value) && 'new' in value;
      const diff = value as { old?: unknown; new?: unknown };
      return isDiff
        ? { key, before: fmt(diff.old), after: fmt(diff.new) }
        : { key, before: null, after: fmt(value) };
    });
  }

  protected contextLine(row: AuditLogRow): string {
    return row.context ? JSON.stringify(row.context) : '';
  }

  /** Trigger rows are proof; client rows are a report from the browser. */
  protected trustLabel(row: AuditLogRow): string {
    return row.source === 'trigger' ? 'Verified' : 'Reported';
  }
}
