import { Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLayoutDashboard, lucideSparkles } from '@ng-icons/lucide';
import { AdminAuth } from '../../../shared/core/services/admin-auth/admin-auth';

@Component({
  selector: 'app-admin-dashboard',
  imports: [NgIcon],
  providers: [provideIcons({ lucideLayoutDashboard, lucideSparkles })],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboard {
  protected readonly auth = inject(AdminAuth);

  /** Admin's display name — full name if set, else the local part of their email. */
  protected readonly displayName = computed(() => {
    const user = this.auth.adminUser();
    return user?.full_name?.trim() || user?.email?.split('@')[0] || 'there';
  });
}
