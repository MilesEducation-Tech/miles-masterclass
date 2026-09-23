import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { Button } from '@shared/ui/button/button';
import { HasPermissionDirective } from '@admin/core/directives/has-permission.directive';
import { PERM } from '@admin/core/models/admin-rbac.model';
import { LeadsTable } from '@admin/leads/components/leads-table/leads-table';
import { LeadsFacade } from '@admin/leads/services/leads-facade';
import { LeadStatus, LeadStatusFilter } from '@admin/leads/models/firm-inquiry.model';
import { TabStrip } from '@shared/ui/tab-strip/tab-strip';

const STATUS_TABS: { value: LeadStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

@Component({
  selector: 'app-admin-leads',
  imports: [AriaInput, Button, LeadsTable, HasPermissionDirective, TabStrip],
  templateUrl: './leads.html',
  styleUrl: './leads.css',
  host: { class: 'block w-full' },
})
export class Leads {
  protected readonly facade = inject(LeadsFacade);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly PERM = PERM;
  /** Raw search input — debounced before reaching the facade. */
  protected readonly searchInput = signal('');

  constructor() {
    toObservable(this.searchInput)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.facade.setSearch(value));
  }

  /** app-tab-strip speaks labels; map them back to the filter values. */
  protected readonly tabLabels = STATUS_TABS.map((t) => t.label);
  protected readonly activeTabLabel = computed(
    () => STATUS_TABS.find((t) => this.isActiveTab(t.value))?.label ?? null,
  );
  protected onTabChange(label: string): void {
    const tab = STATUS_TABS.find((t) => t.label === label);
    if (tab) this.selectStatus(tab.value);
  }

  protected isActiveTab(value: LeadStatusFilter): boolean {
    return this.facade.statusFilter() === value;
  }

  protected selectStatus(value: LeadStatusFilter): void {
    this.facade.setStatusFilter(value);
  }

  protected goPrev(): void {
    this.facade.setPage(this.facade.currentPage() - 1);
  }

  protected goNext(): void {
    this.facade.setPage(this.facade.currentPage() + 1);
  }

  protected onStatusChange(event: { id: number; status: LeadStatus }): void {
    void this.facade.updateLead(event.id, { status: event.status });
  }

  protected onNotesChange(event: { id: number; notes: string }): void {
    void this.facade.updateLead(event.id, { notes: event.notes });
  }

  protected onExport(): void {
    void this.facade.exportCsv();
  }
}
