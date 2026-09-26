import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CopilotWorkflow } from '@core/models/ai-lab.model';
import { AiLabSubmission } from '@core/services/ai-lab-submission/ai-lab-submission';
import { environment } from '@env/environment';
import { provideMockDialogRef, stubDialogShell } from '@testing/mocks/dialog-ref.mock';

import { AiLabAgentDialog } from './ai-lab-agent-dialog';

const WORKFLOWS: CopilotWorkflow[] = [
  { id: 'wf-a', name: 'Invoice triage', environmentName: 'Default', publishedOn: '2 Aug 2026' },
  { id: 'wf-b', name: 'Expense check', environmentName: 'Default', publishedOn: '9 Aug 2026' },
];

describe('AiLabAgentDialog workflow picker', () => {
  let fixture: ComponentFixture<AiLabAgentDialog>;
  let host: HTMLElement;
  const submit = vi.fn(() => of(null));
  const flag = environment.AI_LABS.assessmentEnabled;

  const radios = () => Array.from(host.querySelectorAll<HTMLElement>('[role="radio"]'));
  const submitButton = () =>
    Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Submit for scoring'),
    )!;

  beforeEach(async () => {
    // Read once at construction, so it has to be on before the component exists.
    environment.AI_LABS.assessmentEnabled = true;
    submit.mockClear();
    stubDialogShell(AiLabAgentDialog);
    await TestBed.configureTestingModule({
      imports: [AiLabAgentDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockDialogRef({ name: 'Agent', description: '', chapterId: 7 }),
        {
          provide: AiLabSubmission,
          useValue: {
            getReport: () => null,
            listPublishedWorkflows: () => of(WORKFLOWS),
            submit,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AiLabAgentDialog);
    host = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    environment.AI_LABS.assessmentEnabled = flag;
  });

  it('renders the workflows as an ng-primitives radio group with nothing picked', () => {
    const group = host.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-label')).toBe('Your published Copilot workflows');
    expect(group.getAttribute('aria-orientation')).toBe('vertical');
    expect(radios().length).toBe(2);
    expect(radios().every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(submitButton().disabled).toBe(true);
  });

  it('picking a workflow checks it and submits that one', async () => {
    radios()[1].click();
    await fixture.whenStable();

    expect(radios()[1].getAttribute('aria-checked')).toBe('true');
    expect(radios()[0].getAttribute('aria-checked')).toBe('false');

    submitButton().click();
    expect(submit).toHaveBeenCalledWith(7, WORKFLOWS[1]);
  });

  it('focusing a workflow selects it (ngpRadioItem selects on focus), but submits nothing', async () => {
    radios()[0].focus();
    await fixture.whenStable();

    expect(radios()[0].getAttribute('aria-checked')).toBe('true');
    expect(submitButton().disabled).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });
});
