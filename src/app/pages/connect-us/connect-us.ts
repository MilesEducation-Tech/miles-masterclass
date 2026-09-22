import { Component, input } from '@angular/core';
import { EnquiryForm } from '@shared/components/enquiry-form/enquiry-form';
import { Faq } from '../faq/faq';

@Component({
  selector: 'app-connect-us',
  imports: [EnquiryForm, Faq],
  templateUrl: './connect-us.html',
  styleUrl: './connect-us.css',
})
export class ConnectUs {
  enquiryType = input<string>('');
}
