import { computed, inject, Signal } from '@angular/core';
import { Utils } from '@shared/services/utils';

/**
 * `/{country}/{profession}` — the prefix every link out of the tracker is built on.
 *
 * One copy, because the tracker had three: `trackerLinks()`, `localeLink()` and
 * `CpeTracker`'s own private getter each rebuilt the same string. Repo-wide there are
 * several more shapes (`Utils.localePath()`, `coursePagePath()`, the `['/', country,
 * profession, …]` array form in the shared cards); this consolidates the tracker's, not
 * theirs.
 *
 * Must be called from an injection context.
 */
export function localePrefix(): Signal<string> {
  const utils = inject(Utils);
  return computed(() => `/${utils.country()}/${utils.profession()}`);
}

/**
 * Absolute `routerLink` commands for the tracker's pages.
 *
 * Deliberately not relative (`'..'`): the tracker's route tree nests two
 * empty-path routes under `caira-tracker`, and Angular resolves `..` by route
 * level rather than by URL segment — so a relative link silently lands one
 * level off.
 *
 * Must be called from an injection context.
 */
export function trackerLinks(): {
  home: Signal<unknown[]>;
  for: (page: string) => Signal<unknown[]>;
} {
  const prefix = localePrefix();
  return {
    home: computed(() => [prefix(), 'caira-tracker']),
    for: (page: string) => computed(() => [prefix(), 'caira-tracker', page]),
  };
}

/** Absolute link to a sibling feature under the same locale prefix. */
export function localeLink(segment: string): Signal<unknown[]> {
  const prefix = localePrefix();
  return computed(() => [prefix(), segment]);
}
