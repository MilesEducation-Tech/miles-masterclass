import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Button } from '@shared/ui/button/button';
import { HasPermissionDirective } from '@admin/core/directives/has-permission';
import { PERM } from '@admin/core/models/admin-rbac.model';
import { LeadsTable } from '@admin/leads/components/leads-table/leads-table';
import { LeadsFacade } from '@admin/leads/services/leads-facade';
import { LeadStatus, LeadStatusFilter } from '@admin/leads/models/firm-inquiry.model';

import { Field } from '@shared/ui/field/field';
import { NgpLabel } from 'ng-primitives/form-field';
import { Input } from '@shared/ui/input/input';
import { Tabs } from '@shared/ui/tabs/tabs';
import { Tab } from '@shared/ui/tabs/tab';

const STATUS_TABS: { value: LeadStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

@Component({
  selector: 'app-admin-leads',
  imports: [Button, LeadsTable, HasPermissionDirective, Field, NgpLabel, Input, Tabs, Tab],
  templateUrl: './leads.html',
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
