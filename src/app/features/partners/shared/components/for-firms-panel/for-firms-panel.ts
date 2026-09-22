import { Component } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { iconBentoAi } from '../../models/partner-icons';
import { environment } from '@env/environment';

@Component({
  selector: 'app-for-firms-panel',
  imports: [NgIcon],
  templateUrl: './for-firms-panel.html',
})
export class ForFirmsPanel {
  protected readonly S3_BUCKET_URL = environment.S3_BUCKET_URL;
  protected readonly iconBentoAi = iconBentoAi;
}
