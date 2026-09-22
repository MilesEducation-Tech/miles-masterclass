import { Component, computed, inject } from '@angular/core';
import { LegalDocComponent } from '../shared/components/legal-doc/legal-doc';
import { resolvePrivacyPolicy } from '@core/constants/privacy-policy';
import { Utils } from '@core/services/utils/utils';

@Component({
  selector: 'app-privacy-policy',
  imports: [LegalDocComponent],
  templateUrl: './privacy-policy.html',
  styleUrl: './privacy-policy.css',
})
export class PrivacyPolicy {
  private readonly utils = inject(Utils);

  /** Re-resolves whenever the user navigates between locales. */
  protected readonly doc = computed(() =>
    resolvePrivacyPolicy(this.utils.country(), this.utils.profession()),
  );
}
