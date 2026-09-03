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
  lucideUserPlus,
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
      lucideUserPlus,
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
        {
          id: 'user-onboarding',
          label: 'Create User',
          iconName: 'lucideUserPlus',
          routerLink: '/admin/user-onboarding',
          permission: PERM.USERS_CREATE,
          badge: { value: 'Deprecated', tone: 'warn' },
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
    // Partner Platform v2 mirrors the API doc's two audiences: the Miles-internal
    // superadmin console and the network/firm-admin panel. Permission gating means
    // an admin normally sees only their own group.
    {
      id: 'partner-v2-superadmin',
      label: 'Partner v2 — Super Admin',
      items: [
        {
          id: 'partner-v2-networks',
          label: 'Networks',
          iconName: 'lucideTrendingUp',
          routerLink: '/admin/partner-v2/superadmin/networks',
          permission: PERM.PARTNER_PLATFORM_MANAGE,
        },
        {
          id: 'partner-v2-firms',
          label: 'Firms',
          iconName: 'lucideUsers',
          routerLink: '/admin/partner-v2/superadmin/firms',
          permission: PERM.PARTNER_PLATFORM_MANAGE,
        },
        {
          id: 'partner-v2-codes',
          label: 'Partner Codes',
          iconName: 'lucideTicket',
          routerLink: '/admin/partner-v2/superadmin/codes',
          permission: PERM.PARTNER_PLATFORM_MANAGE,
        },
        {
          id: 'partner-v2-admins',
          label: 'Partner Admins',
          iconName: 'lucideShield',
          routerLink: '/admin/partner-v2/superadmin/partner-admins',
          permission: PERM.PARTNER_PLATFORM_MANAGE,
        },
        {
          id: 'partner-v2-onboarding',
          label: 'User Onboarding',
          iconName: 'lucideUserPlus',
          routerLink: '/admin/partner-v2/superadmin/onboarding',
          permission: PERM.USERS_CREATE,
        },
        {
          id: 'partner-v2-superadmin-reports',
          label: 'Reports',
          iconName: 'lucideChartBar',
          routerLink: '/admin/partner-v2/superadmin/reports',
          permission: PERM.PARTNER_PLATFORM_MANAGE,
        },
      ],
    },
    {
      id: 'partner-v2-panel',
      label: 'Partner v2 — Panel',
      items: [
        {
          id: 'partner-v2-overview',
          label: 'Overview',
          iconName: 'lucideLayoutDashboard',
          routerLink: '/admin/partner-v2/panel/overview',
          permission: [
            PERM.PARTNER_PLATFORM_READ,
            PERM.PARTNER_TRACKER_READ,
            PERM.PARTNER_USERS_READ,
          ],
        },
        {
          id: 'partner-v2-tracker',
          label: 'Seat Tracker',
          iconName: 'lucideClipboardCheck',
          routerLink: '/admin/partner-v2/panel/tracker',
          permission: [PERM.PARTNER_PLATFORM_READ, PERM.PARTNER_TRACKER_READ],
        },
        {
          id: 'partner-v2-users',
          label: 'Users',
          iconName: 'lucideUserCheck',
          routerLink: '/admin/partner-v2/panel/users',
          permission: [PERM.REPORTS_USERS_READ, PERM.PARTNER_TRACKER_READ, PERM.PARTNER_USERS_READ],
        },
        {
          id: 'partner-v2-panel-reports',
          label: 'Reports',
          iconName: 'lucideChartBar',
          routerLink: '/admin/partner-v2/panel/reports',
          permission: [PERM.PARTNER_TRACKER_READ, PERM.PARTNER_USERS_READ],
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
          badge: { value: 'Deprecated', tone: 'warn' },
        },
        {
          id: 'partner-code-tracker',
          label: 'Partner Code Tracker',
          iconName: 'lucideTicket',
          routerLink: '/admin/partner-code-tracker',
          permission: [PERM.PARTNER_PLATFORM_READ, PERM.PARTNER_TRACKER_READ],
          badge: { value: 'Deprecated', tone: 'warn' },
        },
        {
          id: 'vendor-users',
          label: 'Vendor Users',
          iconName: 'lucideUserCheck',
          routerLink: '/admin/domain-users',
          permission: [PERM.REPORTS_USERS_READ, PERM.PARTNER_TRACKER_READ, PERM.PARTNER_USERS_READ],
          badge: { value: 'Deprecated', tone: 'warn' },
        },
        {
          id: 'partner-networks',
          label: 'Networks',
          iconName: 'lucideTrendingUp',
          routerLink: '/admin/partner/networks',
          permission: PERM.PARTNER_PLATFORM_MANAGE,
          badge: { value: 'Deprecated', tone: 'warn' },
        },
        {
          id: 'partner-reports',
          label: 'Reports',
          iconName: 'lucideChartBar',
          routerLink: '/admin/partner/reports',
          permission: PERM.PARTNER_PLATFORM_MANAGE,
          badge: { value: 'Deprecated', tone: 'warn' },
        },
        {
          id: 'partner-codes',
          label: 'Partner Codes',
          iconName: 'lucideTicket',
          routerLink: '/admin/partner/partner-codes',
          permission: PERM.PARTNER_PLATFORM_MANAGE,
          badge: { value: 'Deprecated', tone: 'warn' },
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
