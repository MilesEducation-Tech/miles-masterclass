import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FieldOfStudy } from '@core/models/course.model';

import { CategoriesList } from './categories-list';

const ITEMS: FieldOfStudy[] = [1, 2, 3, 4, 5].map((id) => ({ id, name: `Topic ${id}` }));

@Component({
  imports: [CategoriesList],
  template: `
    <app-categories-list [items]="items" />
    <app-categories-list [items]="items" />
  `,
})
class TwoListsHost {
  readonly items = ITEMS;
}

/**
 * jsdom has no canvas and no layout, so the overflow maths would never hide anything.
 * Every item measures 100px in a 250px container, which fits two and hides three.
 */
function stubLayout(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    measureText: () => ({ width: 20 }),
    font: '',
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(250);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 100,
    height: 20,
    top: 0,
    left: 0,
    right: 100,
    bottom: 20,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('CategoriesList overflow tooltip', () => {
  let fixture: ComponentFixture<TwoListsHost>;
  const triggers = () =>
    Array.from(
      // `[ngpTooltipTrigger]` is a property binding, so it leaves no attribute to select on.
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        'app-categories-list [tabindex="0"]',
      ),
    );
  const openTooltips = () => Array.from(document.querySelectorAll<HTMLElement>('[role="tooltip"]'));

  beforeEach(async () => {
    stubLayout();
    await TestBed.configureTestingModule({ imports: [TwoListsHost] }).compileComponents();
    fixture = TestBed.createComponent(TwoListsHost);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    vi.restoreAllMocks();
  });

  it('collapses the overflow into a focusable "+N more" trigger', () => {
    expect(triggers().length).toBe(2);
    expect(triggers()[0].textContent).toContain('+3 more');
    expect(triggers()[0].getAttribute('tabindex')).toBe('0');
  });

  /** The overlay shows and hides asynchronously, even with zero delays. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
  }

  it('shows the hidden items on focus, describes the trigger, and hides on blur', async () => {
    const trigger = triggers()[0];
    trigger.dispatchEvent(new FocusEvent('focus'));
    await settle();

    const [tooltip] = openTooltips();
    expect(tooltip).toBeDefined();
    expect(tooltip.textContent).toContain('Topic 3');
    expect(tooltip.textContent).toContain('Topic 5');
    expect(tooltip.textContent).not.toContain('Topic 1');
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);

    trigger.dispatchEvent(new FocusEvent('blur'));
    await settle();
    expect(openTooltips().length).toBe(0);
  });

  it('gives each instance its own tooltip id (the hand-rolled one shared a hardcoded id)', async () => {
    const ids: string[] = [];
    for (const trigger of triggers()) {
      trigger.dispatchEvent(new FocusEvent('focus'));
      await settle();
      ids.push(openTooltips()[0].id);
      trigger.dispatchEvent(new FocusEvent('blur'));
      await settle();
    }
    expect(ids.length).toBe(2);
    expect(new Set(ids).size).toBe(2);
  });
});
