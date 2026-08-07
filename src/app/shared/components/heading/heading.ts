import { Component, input } from '@angular/core';

@Component({
  selector: 'app-heading',
  imports: [],
  templateUrl: './heading.html',
  styleUrl: './heading.css',
  host: { class: 'flex flex-col space-y-0.5' },
})
export class Heading {
  heading = input.required<{ text: string; subText?: string }>();
}
