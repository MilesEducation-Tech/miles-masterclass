import { ComponentFixture } from '@angular/core/testing';

/**
 * The few moves every shared/ui contract spec repeats when it drives a control through
 * `form()` + `[formField]`. Specs only: the Host component itself stays in each spec, because
 * its template names the control under test.
 */

/** Flush a render round under zoneless change detection. */
export async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

/** What a user typing does: the value, then `input` (signal forms) and `change`. */
export function typeInto(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Leaving the control: `blur` (native `[formField]`) and `focusout` (custom `touch` outputs). */
export function leave(el: HTMLElement): void {
  el.dispatchEvent(new FocusEvent('blur'));
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}

/** A macrotask, for portalled dropdowns that land on the next task rather than a microtask. */
export function flush(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
