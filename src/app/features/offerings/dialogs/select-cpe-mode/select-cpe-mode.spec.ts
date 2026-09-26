import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgpDialogRef } from 'ng-primitives/dialog';
import { provideMockDialogRef, stubDialogShell } from '@testing/mocks/dialog-ref.mock';

import { SelectCpeMode } from './select-cpe-mode';

describe('SelectCpeMode', () => {
  let component: SelectCpeMode;
  let fixture: ComponentFixture<SelectCpeMode>;
  let el: HTMLElement;

  const cards = () => Array.from(el.querySelectorAll<HTMLElement>('[role="radio"]'));
  const continueButton = () =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Continue with'),
    )!;

  beforeEach(async () => {
    stubDialogShell(SelectCpeMode);
    await TestBed.configureTestingModule({
      imports: [SelectCpeMode],
      providers: [provideMockDialogRef({ type: 'Masterclass', format: 'video', isFree: false })],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectCpeMode);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('is a vertical radiogroup named like the heading, with nothing picked', () => {
    const group = el.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-label')).toBe('Choose your Masterclass mode');
    expect(group.getAttribute('aria-orientation')).toBe('vertical');
    expect(cards()).toHaveLength(2);
    expect(cards().every((c) => c.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(continueButton().disabled).toBe(true);
  });

  it('picks Preview Mode (the false value) and confirms it', async () => {
    cards()[0].click();
    await fixture.whenStable();

    expect(cards()[0].getAttribute('aria-checked')).toBe('true');
    expect(component.selectedMode()).toBe(false);
    component.confirmSelection();
    expect(TestBed.inject(NgpDialogRef).close).toHaveBeenCalledWith({ cpe_mode_status: false });
  });

  it('picks CPE Mode and confirms it', async () => {
    cards()[1].click();
    await fixture.whenStable();

    expect(cards()[1].getAttribute('aria-checked')).toBe('true');
    expect(continueButton().disabled).toBe(false);
    component.confirmSelection();
    expect(TestBed.inject(NgpDialogRef).close).toHaveBeenCalledWith({ cpe_mode_status: true });
  });
});
