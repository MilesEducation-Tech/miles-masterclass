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

  it('does not auto-select the first option when opened with no value', async () => {
    component.onOpenChange(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.value()).toBeNull();
    expect(component.isOpen()).toBe(true);
  });

  it('keeps the current value when the select emits an empty commit', () => {
    component.value.set('a');
    component.onValueChange(null);
    component.onOpenChange(false);

    expect(component.value()).toBe('a');
    expect(component.isOpen()).toBe(false);
  });
});
