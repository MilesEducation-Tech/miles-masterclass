import { Component, computed, inject } from '@angular/core';
import { LegalDocComponent } from '../shared/components/legal-doc/legal-doc';
import { resolveTermsOfService } from '@core/constants/terms-of-service';
import { Utils } from '@shared/services/utils';

@Component({
  selector: 'app-terms-of-service',
  imports: [LegalDocComponent],
  templateUrl: './terms-of-service.html',
  styleUrl: './terms-of-service.css',
})
export class TermsOfService {
  private readonly utils = inject(Utils);

  /** Re-resolves whenever the user navigates between locales. */
  protected readonly doc = computed(() =>
    resolveTermsOfService(this.utils.country(), this.utils.profession()),
  );
}
