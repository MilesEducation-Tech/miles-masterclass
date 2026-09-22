import { computed, inject, Signal } from '@angular/core';
import { Utils } from '@shared/services/utils';

/**
 * Absolute `routerLink` commands for the tracker's pages.
 *
 * Deliberately not relative (`'..'`): the tracker's route tree nests two
 * empty-path routes under `caira-tracker`, and Angular resolves `..` by route
 * level rather than by URL segment — so a relative link silently lands one
 * level off. Building from `Utils.country()/profession()` is what
 * `CourseRouter` already does for the same reason.
 *
 * Must be called from an injection context.
 */
export function trackerLinks(): {
  home: Signal<unknown[]>;
  for: (page: string) => Signal<unknown[]>;
} {
  const utils = inject(Utils);
  const prefix = computed(() => `/${utils.country()}/${utils.profession()}`);
  return {
    home: computed(() => [prefix(), 'caira-tracker']),
    for: (page: string) => computed(() => [prefix(), 'caira-tracker', page]),
  };
}

/** Absolute link to a sibling feature under the same locale prefix. */
export function localeLink(segment: string): Signal<unknown[]> {
  const utils = inject(Utils);
  return computed(() => [`/${utils.country()}/${utils.profession()}`, segment]);
}
