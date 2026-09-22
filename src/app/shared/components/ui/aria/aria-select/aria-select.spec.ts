import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AriaSelect } from './aria-select';

describe('AriaSelect', () => {
  let component: AriaSelect;
  let fixture: ComponentFixture<AriaSelect>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AriaSelect],
    }).compileComponents();

    fixture = TestBed.createComponent(AriaSelect);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'test-select');
    fixture.componentRef.setInput('options', [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ]);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts with no selection', () => {
    expect(component.value()).toBeNull();
  });

  // The open/close cycle and "don't auto-select on open" are `ngpSelect`'s
  // behaviour now, so they are no longer asserted here. What remains ours is
  // the null-emission guard: the primitive prunes values that aren't in the
  // rendered options (e.g. a seeded value before async options land), and that
  // must not wipe the current selection.
  it('keeps the current value when the select emits a null commit', () => {
    component.value.set('a');
    component['onValueChange'](null);

    expect(component.value()).toBe('a');
  });

  it('mirrors the selected option label', () => {
    component.value.set('b');
    expect(component.selectedLabel()).toBe('Beta');
  });
});
