import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AdminAuth } from '@core/services/admin-auth/admin-auth';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[hasPermission]',
})
export class HasPermissionDirective {
  private readonly auth = inject(AdminAuth);
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);

  readonly hasPermission = input.required<string | string[]>();

  constructor() {
    effect(() => {
      const required = this.hasPermission();
      const ok = Array.isArray(required)
        ? this.auth.hasAny(...required)
        : this.auth.hasPermission(required);

      this.vcr.clear();
      if (ok) this.vcr.createEmbeddedView(this.tpl);
    });
  }
}
