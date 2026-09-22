import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldAlert } from '@ng-icons/lucide';
import { Button } from '@shared/ui/button/button';
import { AdminAuth } from '@admin/core/services/admin-auth';
import { adminLandingPath } from '../../utils/admin-landing';

@Component({
  selector: 'app-forbidden',
  imports: [Button, NgIcon],
  providers: [provideIcons({ lucideShieldAlert })],
  templateUrl: './forbidden.html',
  styleUrl: './forbidden.css',
})
export class Forbidden {
  private readonly router = inject(Router);
  private readonly auth = inject(AdminAuth);

  goHome(): void {
    this.router.navigateByUrl(adminLandingPath(this.auth));
  }
}
