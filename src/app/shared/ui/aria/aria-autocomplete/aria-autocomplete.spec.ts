import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AriaAutocomplete } from './aria-autocomplete';

describe('AriaAutocomplete', () => {
  let component: AriaAutocomplete;
  let fixture: ComponentFixture<AriaAutocomplete>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AriaAutocomplete],
    }).compileComponents();

    fixture = TestBed.createComponent(AriaAutocomplete);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'test-autocomplete');
    fixture.componentRef.setInput('options', [
      { value: '+1', label: '+1' },
      { value: '+91', label: '+91' },
      { value: '+92', label: '+92' },
    ]);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not auto-commit the first option while the user types', async () => {
    component.onFocus();
    fixture.detectChanges();
    await fixture.whenStable();

    component.query.set('+9');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.value()).toBeNull();
    expect(component.query()).toBe('+9');
  });

  // `isOpen` used to be asserted above, from when this component opened its own
  // dropdown on focus. After the ng-primitives migration the primitive owns the
  // dropdown and `isOpen` is only a mirror fed by `onOpenChange` (it drives the
  // chevron rotation), so focus alone no longer sets it. The mirror itself is
  // worth pinning, since the chevron is the only thing that reads it.
  it('mirrors the primitive dropdown state and marks itself touched on close', () => {
    component['onOpenChange'](true);
    expect(component.isOpen()).toBe(true);

    component['onOpenChange'](false);
    expect(component.isOpen()).toBe(false);
    expect(component.touched()).toBe(true);
  });

  it('does not mirror the selected label into the input while it has focus', async () => {
    component.onFocus();
    component.value.set('+91');
    await fixture.whenStable();
    component.query.set('+9');
    // Simulate a server-driven options refresh mid-typing.
    fixture.componentRef.setInput('options', [
      { value: '+91', label: '+91' },
      { value: '+92', label: '+92' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.query()).toBe('+9');
  });
});
