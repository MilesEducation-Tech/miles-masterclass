import { NgClass } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AriaInput } from '../../shared/components/ui/aria/aria-input/aria-input';
import { Button } from '../../shared/components/ui/button/button';
import { HasPermissionDirective } from '../shared/directives/has-permission.directive';
import { PERM } from '../../shared/core/models/admin/admin-rbac.model';
import { LeadsTable } from './shared/components/leads-table/leads-table';
import { LeadsFacade } from './shared/services/leads-facade';
import { LeadStatus, LeadStatusFilter } from './shared/models/firm-inquiry.model';

const STATUS_TABS: { value: LeadStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

@Component({
  selector: 'app-admin-leads',
  imports: [AriaInput, Button, LeadsTable, HasPermissionDirective, NgClass],
  templateUrl: './leads.html',
  styleUrl: './leads.css',
  host: { class: 'block w-full' },
})
export class Leads {
  protected readonly facade = inject(LeadsFacade);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly PERM = PERM;
  protected readonly statusTabs = STATUS_TABS;
  /** Raw search input — debounced before reaching the facade. */
  protected readonly searchInput = signal('');

  constructor() {
    toObservable(this.searchInput)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.facade.setSearch(value));
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

  protected onStatusChange(event: { id: string; status: LeadStatus }): void {
    void this.facade.updateStatus(event.id, event.status);
  }

  protected onExport(): void {
    void this.facade.exportCsv();
  }
}
