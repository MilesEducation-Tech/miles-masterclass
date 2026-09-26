import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdminAuth } from '@admin/core/services/admin-auth';
import { FirmInquiry } from '@admin/leads/models/firm-inquiry.model';
import { LeadsTable } from './leads-table';

const lead = (id: number, notes = ''): FirmInquiry =>
  ({
    id,
    full_name: `Lead ${id}`,
    email: `lead${id}@firm.com`,
    firm_name: 'Firm',
    job_role: '',
    help_type: [],
    enquiry_type: 'demo',
    status: 'new',
    notes,
    created_at: '2026-09-01T00:00:00Z',
  }) as unknown as FirmInquiry;

describe('LeadsTable notes disclosure', () => {
  let fixture: ComponentFixture<LeadsTable>;
  let el: HTMLElement;
  const toggle = (name: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label$="notes for ${name}"]`)!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadsTable],
      providers: [{ provide: AdminAuth, useValue: { hasPermission: () => false } }],
    }).compileComponents();
    fixture = TestBed.createComponent(LeadsTable);
    fixture.componentRef.setInput('rows', [lead(1, 'Called on Monday'), lead(2, 'Budget next Q')]);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('puts aria-expanded on the focusable button, one tbody per lead', () => {
    expect(el.querySelectorAll('tbody')).toHaveLength(2);
    const btn = toggle('Lead 1');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(el.textContent).not.toContain('Called on Monday');
  });

  it('opens the notes of one lead, linked by aria-controls, and closes them again', async () => {
    toggle('Lead 1').click();
    await fixture.whenStable();

    const btn = toggle('Lead 1');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('Hide notes for Lead 1');
    const panel = el.querySelector(`[id="${btn.getAttribute('aria-controls')}"]`)!;
    expect(panel.textContent).toContain('Called on Monday');
    expect(el.textContent).not.toContain('Budget next Q');

    toggle('Lead 1').click();
    await fixture.whenStable();
    expect(el.textContent).not.toContain('Called on Monday');
  });
});
