import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgpDescription, NgpFormField, NgpLabel } from 'ng-primitives/form-field';

import { Select, SelectOption } from './select';

const OPTIONS: SelectOption[] = [
  { value: 'licensed_accountant', label: 'Licensed accountant' },
  { value: 'working_professional', label: 'Working professional' },
  { value: 'student', label: 'Student' },
];

describe('Select', () => {
  let component: Select;
  let fixture: ComponentFixture<Select>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Select] }).compileComponents();

    fixture = TestBed.createComponent(Select);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'intent');
    fixture.componentRef.setInput('options', OPTIONS);
    await fixture.whenStable();
  });

  // The DOM lowercases attribute names, and jsdom's selector engine is case
  // sensitive about them — `[ngpSelectOption]` silently matches nothing here.
  const trigger = (): HTMLElement => fixture.nativeElement.querySelector('[ngpselect]');
  /** The dropdown is portalled, so it is not under the fixture element. */
  const renderedOptions = (): HTMLElement[] =>
    Array.from(document.querySelectorAll('[ngpselectoption]'));

  async function open(): Promise<void> {
    fixture.detectChanges();
    trigger().click();
    // The dropdown is portalled on a render hook, so a microtask flush is not
    // enough — it lands on the next macrotask.
    await new Promise((resolve) => setTimeout(resolve, 20));
    fixture.detectChanges();
  }

  it('shows the placeholder until something is chosen', () => {
    fixture.componentRef.setInput('placeholder', 'What brings you here?');
    fixture.detectChanges();

    expect(trigger().textContent).toContain('What brings you here?');
  });

  it('renders every option once opened, in the order given', async () => {
    await open();

    const labels = renderedOptions().map((o) => o.querySelector('span')?.textContent?.trim());
    expect(labels).toEqual(['Licensed accountant', 'Working professional', 'Student']);
  });

  /**
   * `@for (… track option.value)` throws NG0955 on a repeated key, which takes
   * the whole dropdown down — so a server that repeats a value must not be able
   * to break the control.
   */
  it('drops duplicate option values instead of throwing', async () => {
    fixture.componentRef.setInput('options', [
      { value: 'student', label: 'Student' },
      { value: 'student', label: 'Student (duplicate)' },
      { value: 'other', label: 'Other' },
    ]);
    await open();

    const labels = renderedOptions().map((o) => o.querySelector('span')?.textContent?.trim());
    expect(labels).toEqual(['Student', 'Other']);
  });

  it('commits the clicked option as a LIST, the shape the API stores', async () => {
    await open();

    renderedOptions()[1].click();
    await fixture.whenStable();

    expect(component.value()).toEqual(['working_professional']);
  });

  it('shows the chosen option label on the trigger', async () => {
    component.value.set(['student']);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(trigger().textContent).toContain('Student');
  });

  it('joins the labels in multiple mode', async () => {
    fixture.componentRef.setInput('multiple', true);
    component.value.set(['student', 'licensed_accountant']);
    await fixture.whenStable();
    fixture.detectChanges();

    // Option order, not click order — the trigger reads as the list does.
    expect(trigger().textContent).toContain('Licensed accountant, Student');
  });

  /**
   * The regression that matters on a server-driven form: options and answers
   * come from two different resources, so a seeded answer can arrive BEFORE the
   * options it belongs to. `ngpSelect` prunes what it cannot see and emits the
   * pruned result — taken at face value, that silently erases the learner's
   * saved answer.
   */
  it('keeps a seeded value the options have not caught up with', () => {
    component.value.set(['licensed_accountant']);
    fixture.componentRef.setInput('options', []);

    component['onValueChange'](null);

    expect(component.value()).toEqual(['licensed_accountant']);
  });

  it('still lets a rendered value be deselected', () => {
    component.value.set(['student']);

    component['onValueChange'](null);

    expect(component.value()).toEqual([]);
  });

  it('marks itself touched when the dropdown closes', () => {
    expect(component.touched()).toBe(false);

    component['onOpenChange'](true);
    expect(component.touched()).toBe(false);

    component['onOpenChange'](false);
    expect(component.touched()).toBe(true);
  });

  /**
   * `ngpInput`, `ngpTextarea` and `ngpCheckbox` all call `ngpFormControl`
   * internally and get named for free. `ngpSelect` does NOT, so without this
   * wiring a select inside a form field announces with no name at all — and a
   * `<label for>` cannot fix it, because the trigger is a `div`.
   */
  describe('inside an ngpFormField', () => {
    @Component({
      imports: [Select, NgpFormField, NgpLabel, NgpDescription],
      template: `
        <div ngpFormField>
          <span ngpLabel id="intent-label">What brings you here?</span>
          <p ngpDescription id="intent-help">Pick the closest match.</p>
          <app-select id="intent" [options]="options" />
        </div>
      `,
    })
    class Host {
      readonly options = OPTIONS;
    }

    it('takes its accessible name and description from the field', async () => {
      const host = TestBed.createComponent(Host);
      host.detectChanges();
      await host.whenStable();
      host.detectChanges();

      const combobox: HTMLElement = host.nativeElement.querySelector('[ngpselect]');

      expect(combobox.getAttribute('role')).toBe('combobox');
      expect(combobox.getAttribute('aria-labelledby')).toBe('intent-label');
      expect(combobox.getAttribute('aria-describedby')).toBe('intent-help');
    });
  });
});
