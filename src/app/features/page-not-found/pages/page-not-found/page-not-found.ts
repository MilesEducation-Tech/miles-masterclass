import { Component, inject, RESPONSE_INIT, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { heroArrowLeft } from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-page-not-found',
  imports: [RouterLink, NgIcon],
  templateUrl: './page-not-found.html',
  styleUrl: './page-not-found.css',
})
export class PageNotFound {
  readonly icons = signal({
    arrowLeft: heroArrowLeft,
  });

  constructor() {
    // Server only (`RESPONSE_INIT` is null in the browser). `maintenance`
    // shares this page without `notFound`, so it keeps its 200.
    const response = inject(RESPONSE_INIT, { optional: true });
    if (response && inject(ActivatedRoute).snapshot.data['notFound']) response.status = 404;
  }
}
