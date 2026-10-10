import { HttpContext } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiClient } from '../api-client/api-client';
import { Logger } from '../logger/logger';
import { SKIP_LOADING } from '../../models/http.model';
import {
  SEARCH_ROUTES,
  SearchSuggestion,
  SearchSuggestionResponse,
} from '../../models/search.model';

/**
 * Thin wrapper around the `v2/dashboard/suggestion/` endpoint. Returns a
 * cold observable so callers can plug it into a debounced `switchMap` —
 * in-flight requests are cancelled by the operator when a new query arrives.
 */
@Service()
export class GlobalSearch {
  private readonly api = inject(ApiClient);
  private readonly logger = inject(Logger);

  search(query: string): Observable<SearchSuggestion[]> {
    const q = query.trim();
    if (!q) return of([]);
    return this.api
      .get<SearchSuggestionResponse>(SEARCH_ROUTES.suggestion.path, {
        params: { search_key: q },
        // Typeahead, behind the dialog's own spinner: not the loading bar.
        context: new HttpContext().set(SKIP_LOADING, true),
      })
      .pipe(
        map((res) => res?.data ?? []),
        catchError((err) => {
          this.logger.error('Global search failed', err);
          return of([]);
        }),
      );
  }
}
