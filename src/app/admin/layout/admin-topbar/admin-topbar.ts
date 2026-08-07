import { Component, computed, inject, output } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePanelLeft,
  lucideBell,
  lucideDownload,
  lucidePlus,
  lucideSearch,
} from '@ng-icons/lucide';

interface Crumb {
  label: string;
  link?: string;
}

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Admin dashboard',
  '/admin/dashboard': 'Admin dashboard',
  '/admin/seo': 'SEO pages',
  '/admin/leads': 'Leads',
  '/admin/reports/courses': 'Courses report',
  '/admin/reports/user-report': 'User report',
  '/admin/domain-users': 'Domain users',
  '/admin/roles-permissions': 'Roles & permissions',
  '/admin/forbidden': 'Access denied',
};

const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  dashboard: 'Dashboard',
  seo: 'SEO',
  edit: 'Edit',
  leads: 'Leads',
  reports: 'Reports',
  courses: 'Courses',
  'user-report': 'User report',
  'domain-users': 'Domain users',
  'roles-permissions': 'Roles & permissions',
  forbidden: 'Forbidden',
  login: 'Login',
};

@Component({
  selector: 'app-admin-topbar',
  imports: [NgIcon],
  providers: [
    provideIcons({ lucidePanelLeft, lucideBell, lucideDownload, lucidePlus, lucideSearch }),
  ],
  templateUrl: './admin-topbar.html',
  styleUrl: './admin-topbar.css',
})
export class AdminTopbar {
  private readonly router = inject(Router);

  readonly toggleSidebar = output<void>();

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly title = computed(() => {
    const url = this.normalizedUrl();
    if (PAGE_TITLES[url]) return PAGE_TITLES[url];

    const crumbs = this.crumbs();
    return crumbs.length > 0 ? crumbs[crumbs.length - 1].label : 'Admin';
  });

  readonly crumbs = computed<Crumb[]>(() => {
    const url = this.normalizedUrl();
    const segments = url.split('/').filter(Boolean);
    if (segments.length === 0) return [];

    const visible = segments[0] === 'admin' ? segments.slice(1) : segments;
    if (visible.length === 0) return [{ label: 'Admin' }];

    let cumulative = '/admin';
    return visible.map((segment, idx) => {
      cumulative = `${cumulative}/${segment}`;
      const label = SEGMENT_LABELS[segment] ?? this.titleCase(segment);
      return idx === visible.length - 1 ? { label } : { label, link: cumulative };
    });
  });

  /** Workspace label shown in the top crumb (could later come from user profile). */
  readonly workspaceLabel = 'Miles Masterclass';

  private normalizedUrl(): string {
    return this.currentUrl().split('?')[0].split('#')[0];
  }

  private titleCase(s: string): string {
    return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
