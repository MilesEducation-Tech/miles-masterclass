import { linkedSignal, Resource, resourceFromSnapshots, ResourceSnapshot } from '@angular/core';

/**
 * Wraps a `Resource<T>` so that while it is reloading, `value()` keeps returning
 * the last resolved value (stale-while-revalidate). `status()` still flips to
 * `loading`, so spinners still react.
 */
export function withPreviousValue<T>(input: Resource<T>): Resource<T> {
  const derived = linkedSignal<ResourceSnapshot<T>, ResourceSnapshot<T>>({
    source: input.snapshot,
    computation: (snap, previous) => {
      if (snap.status === 'loading' && previous && previous.value.status !== 'error') {
        return { status: 'loading' as const, value: previous.value.value };
      }
      return snap;
    },
  });
  return resourceFromSnapshots(derived);
}
