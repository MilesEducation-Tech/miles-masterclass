import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AI_LAB_ASSESSMENT_REPORT } from '@core/models/ai-lab-assessment.model';
import { ContentAbout } from '@core/models/course.model';

import { AiLabAgentAbout } from './ai-lab-agent-about';

describe('AiLabAgentAbout assessment report', () => {
  let fixture: ComponentFixture<AiLabAgentAbout>;
  let host: HTMLElement;

  const rowTriggers = () =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-controls]'));
  const panelFor = (trigger: HTMLElement) =>
    host.querySelector<HTMLElement>(`#${trigger.getAttribute('aria-controls')}`)!;
  const wrongOnly = () => host.querySelector<HTMLButtonElement>('[role="switch"]')!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AiLabAgentAbout] }).compileComponents();
    fixture = TestBed.createComponent(AiLabAgentAbout);
    fixture.componentRef.setInput('card', {
      course_overview: '',
      learning_objective_list: [],
    } as unknown as ContentAbout);
    fixture.componentRef.setInput('report', AI_LAB_ASSESSMENT_REPORT);
    host = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('renders one native-button disclosure per flow check and per question', () => {
    const { flow, mcq } = AI_LAB_ASSESSMENT_REPORT;
    expect(rowTriggers().length).toBe(flow.checks.length + mcq.questions.length);
    for (const trigger of rowTriggers()) {
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(panelFor(trigger)).not.toBeNull();
    }
  });

  it('expands and collapses one row without touching the others', async () => {
    const [first, second] = rowTriggers();

    first.click();
    await fixture.whenStable();
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(panelFor(first).hasAttribute('data-open')).toBe(true);
    expect(second.getAttribute('aria-expanded')).toBe('false');

    first.click();
    await fixture.whenStable();
    expect(first.getAttribute('aria-expanded')).toBe('false');
  });

  it('the "wrong only" switch filters the questions to the incorrect ones', async () => {
    const { mcq } = AI_LAB_ASSESSMENT_REPORT;
    const wrong = mcq.questions.filter((q) => !q.isCorrect).length;
    const before = rowTriggers().length;
    expect(wrongOnly().getAttribute('aria-checked')).toBe('false');

    wrongOnly().click();
    await fixture.whenStable();

    expect(wrongOnly().getAttribute('aria-checked')).toBe('true');
    expect(rowTriggers().length).toBe(before - mcq.questions.length + wrong);
  });
});
