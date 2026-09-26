import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AriaInput } from './aria-input';

describe('AriaInput', () => {
  let component: AriaInput;
  let fixture: ComponentFixture<AriaInput>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AriaInput],
    }).compileComponents();

    fixture = TestBed.createComponent(AriaInput);
    fixture.componentRef.setInput('id', 'email');
    component = fixture.componentInstance;
    host = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('checkbox', () => {
    let box: HTMLButtonElement;

    beforeEach(async () => {
      fixture.componentRef.setInput('type', 'checkbox');
      fixture.componentRef.setInput('label', 'I agree');
      fixture.componentRef.setInput('required', true);
      await fixture.whenStable();
      box = host.querySelector('[role="checkbox"]')!;
    });

    it('renders an ng-primitives checkbox wired to the label', () => {
      expect(box.id).toBe('email-input');
      expect(box.getAttribute('aria-checked')).toBe('false');
      expect(box.getAttribute('aria-required')).toBe('true');
      expect(host.querySelector('label')!.getAttribute('for')).toBe('email-input');
    });

    it('toggles the value on click', async () => {
      box.click();
      await fixture.whenStable();
      expect(component.value()).toBe(true);
      expect(box.getAttribute('aria-checked')).toBe('true');
      expect(box.hasAttribute('data-checked')).toBe(true);

      box.click();
      await fixture.whenStable();
      expect(component.value()).toBe(false);
    });

    it('toggles on Space but not on Enter', async () => {
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await fixture.whenStable();
      expect(component.value()).toBeFalsy();

      box.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await fixture.whenStable();
      expect(component.value()).toBe(true);
    });

    it('keeps aria-describedby on the hint from the first render', async () => {
      fixture.componentRef.setInput('hint', 'Needed to continue');
      await fixture.whenStable();
      expect(box.getAttribute('aria-describedby')).toBe('email-hint');
    });

    it('does not toggle when disabled', async () => {
      fixture.componentRef.setInput('disabled', true);
      await fixture.whenStable();
      box.click();
      await fixture.whenStable();
      expect(component.value()).toBeFalsy();
    });

    it('marks touched on blur and points aria-describedby at the error', async () => {
      fixture.componentRef.setInput('invalid', true);
      fixture.componentRef.setInput('errors', [{ message: 'Required' }]);
      box.dispatchEvent(new FocusEvent('blur'));
      await fixture.whenStable();
      expect(component.touched()).toBe(true);
      expect(box.getAttribute('aria-invalid')).toBe('true');
      expect(box.getAttribute('aria-describedby')).toBe('email-error');
    });
  });

  describe('radio', () => {
    let group: HTMLElement;
    let radios: HTMLElement[];

    beforeEach(async () => {
      fixture.componentRef.setInput('type', 'radio');
      fixture.componentRef.setInput('label', 'Plan');
      fixture.componentRef.setInput('options', [
        { value: 'free', label: 'Free' },
        { value: 'pro', label: 'Pro' },
        { value: 'team', label: 'Team', disabled: true },
      ]);
      await fixture.whenStable();
      group = host.querySelector('[role="radiogroup"]')!;
      radios = Array.from(host.querySelectorAll<HTMLElement>('[role="radio"]'));
    });

    it('renders an ng-primitives radio group labelled by its heading', () => {
      expect(radios.length).toBe(3);
      expect(group.getAttribute('aria-labelledby')).toBe('email-group-label');
      expect(host.querySelector('#email-group-label')!.textContent).toContain('Plan');
    });

    it('selects an option on click and reflects it in aria-checked', async () => {
      radios[1].click();
      await fixture.whenStable();
      expect(component.value()).toBe('pro');
      expect(radios[1].getAttribute('aria-checked')).toBe('true');
      expect(radios[0].getAttribute('aria-checked')).toBe('false');
    });

    it('reflects an external value', async () => {
      component.value.set('free');
      await fixture.whenStable();
      expect(radios[0].getAttribute('aria-checked')).toBe('true');
    });

    it('does not select a disabled option', async () => {
      radios[2].click();
      await fixture.whenStable();
      expect(component.value()).toBeUndefined();
    });

    it('moves the selection with the arrow keys', async () => {
      radios[0].click();
      radios[0].focus();
      await fixture.whenStable();
      radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await fixture.whenStable();
      expect(component.value()).toBe('pro');
      expect(document.activeElement).toBe(radios[1]);
    });

    it('marks touched when focus leaves the group', async () => {
      group.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await fixture.whenStable();
      expect(component.touched()).toBe(true);
    });
  });
});
