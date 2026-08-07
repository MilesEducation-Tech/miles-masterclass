import { Component, computed, inject, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  lucideLayoutDashboard,
  lucideTrendingUp,
  lucideSearch,
  lucideUsers,
  lucideChartBar,
  lucideBookOpen,
  lucideUserCheck,
  lucideChevronRight,
  lucideSettings,
  lucideFileText,
  lucideShield,
  lucideClock,
  lucideClipboardCheck,
  lucideTicket,
} from '@ng-icons/lucide';
import { AdminAuth } from '../../../shared/core/services/admin-auth/admin-auth';
import { PERM } from '../../../shared/core/models/admin/admin-rbac.model';
import { logo, logoIcon } from '../../../shared/core/constant/icon';

interface SidebarItem {
  id: string;
  label: string;
  iconName: string;
  routerLink?: string;
  /** Single key, or a list — the item shows if the admin has ANY of them. */
  permission?: string | string[];
  /** Role slugs that must never see this item, even if `permission` matches. */
  excludeRoles?: string[];
  badge?: { value: string; tone?: 'default' | 'warn' };
}

interface SidebarSection {
  id: string;
  label: string;
  items: SidebarItem[];
}

@Component({
  selector: 'app-admin-sidebar',
  imports: [NgIcon, RouterLink, RouterLinkActive],
  providers: [
    provideIcons({
      lucideLayoutDashboard,
      lucideTrendingUp,
      lucideSearch,
      lucideUsers,
      lucideChartBar,
      lucideBookOpen,
      lucideUserCheck,
      lucideChevronRight,
      lucideSettings,
      lucideFileText,
      lucideShield,
      lucideClock,
      lucideClipboardCheck,
      lucideTicket,
    }),
  ],
  templateUrl: './admin-sidebar.html',
  styleUrl: './admin-sidebar.css',
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class AdminSidebar {
  protected readonly auth = inject(AdminAuth);
  private readonly router = inject(Router);

  readonly collapsed = input(false);
  readonly userMenuOpen = signal(false);
  logos = {
    logo,
    logoIcon,
  };

  private readonly sections: SidebarSection[] = [
    {
      id: 'overview',
      label: 'Overview',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          iconName: 'lucideLayoutDashboard',
          routerLink: '/admin/dashboard',
          permission: PERM.DASHBOARD_VIEW,
        },
      ],
    },
    {
      id: 'content',
      label: 'Content',
      items: [
        {
          id: 'seo',
          label: 'SEO pages',
          iconName: 'lucideSearch',
          routerLink: '/admin/seo',
          permission: PERM.SEO_READ,
        },
      ],
    },
    {
      id: 'people',
      label: 'People',
      items: [
        {
          id: 'leads',
          label: 'Leads',
          iconName: 'lucideUsers',
          routerLink: '/admin/leads',
          permission: PERM.LEADS_READ,
        },
      ],
    },
    {
      id: 'reports',
      label: 'Reports',
      items: [
        {
          id: 'reports-courses',
          label: 'Courses',
          iconName: 'lucideBookOpen',
          routerLink: '/admin/reports/courses',
          permission: PERM.REPORTS_COURSES_READ,
        },
        {
          id: 'reports-user-report',
          label: 'User report',
          iconName: 'lucideUserCheck',
          routerLink: '/admin/reports/user-report',
          permission: PERM.REPORTS_USER_REPORT_READ,
        },
      ],
    },
    {
      id: 'partner-platform',
      label: 'Partner Platform',
      items: [
        {
          id: 'partner-dashboard',
          label: 'Dashboard',
          iconName: 'lucideLayoutDashboard',
          routerLink: '/admin/partner/dashboard',
          permission: PERM.PARTNER_PLATFORM_READ,
        },
        {
          id: 'partner-code-tracker',
          label: 'Partner Code Tracker',
          iconName: 'lucideTicket',
          routerLink: '/admin/partner-code-tracker',
          permission: [PERM.PARTNER_PLATFORM_READ, PERM.PARTNER_TRACKER_READ],
        },
        {
          id: 'vendor-users',
          label: 'Vendor Users',
          iconName: 'lucideUserCheck',
          routerLink: '/admin/domain-users',
          permission: [PERM.REPORTS_USERS_READ, PERM.PARTNER_TRACKER_READ, PERM.PARTNER_USERS_READ],
        },
        {
          id: 'partner-networks',
          label: 'Networks',
          iconName: 'lucideTrendingUp',
          routerLink: '/admin/partner/networks',
          permission: PERM.PARTNER_PLATFORM_MANAGE,
        },
        {
          id: 'partner-codes',
          label: 'Partner Codes',
          iconName: 'lucideTicket',
          routerLink: '/admin/partner/partner-codes',
          permission: PERM.PARTNER_PLATFORM_MANAGE,
        },
      ],
    },
    {
      id: 'administration',
      label: 'Administration',
      items: [
        {
          id: 'admin-users',
          label: 'Admin Users',
          iconName: 'lucideShield',
          routerLink: '/admin/admin-users',
          permission: PERM.ADMIN_USERS_MANAGE,
        },
        {
          id: 'roles-permissions',
          label: 'Roles & permissions',
          iconName: 'lucideSettings',
          routerLink: '/admin/roles-permissions',
          permission: [PERM.ADMIN_ROLES_MANAGE, PERM.ADMIN_PERMISSIONS_MANAGE],
        },
      ],
    },
  ];

  readonly visibleSections = computed<SidebarSection[]>(() => {
    // Re-evaluate when permissions change
    this.auth.permissions();
    this.auth.roleSlug();

    return this.sections
      .map((section) => {
        const visibleItems = section.items.filter((item) => {
          const slug = this.auth.roleSlug();
          if (slug && item.excludeRoles?.includes(slug)) return false;
          if (!item.permission) return true;
          return Array.isArray(item.permission)
            ? this.auth.hasAny(...item.permission)
            : this.auth.hasPermission(item.permission);
        });
        return visibleItems.length === 0 ? null : { ...section, items: visibleItems };
      })
      .filter((s): s is SidebarSection => s !== null);
  });

  readonly userInitial = computed(() => {
    const u = this.auth.adminUser();
    const source = u?.full_name || u?.email || '';
    return source.charAt(0).toUpperCase() || 'A';
  });

  readonly displayName = computed(() => {
    const u = this.auth.adminUser();
    return u?.full_name || u?.email || 'Admin';
  });

  readonly displayEmail = computed(() => this.auth.adminUser()?.email ?? '');

  readonly roleLabel = computed(() => {
    const slug = this.auth.roleSlug();
    if (!slug) return 'Admin';
    return slug.replace(/_/g, ' ').toUpperCase();
  });

  toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  async logout(): Promise<void> {
    this.closeUserMenu();
    await this.auth.signOut();
    await this.router.navigateByUrl('/admin/login');
  }

  protected onEscape(): void {
    if (this.userMenuOpen()) this.closeUserMenu();
  }
}
