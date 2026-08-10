import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrackerToolbar } from './tracker-toolbar';
import {
  BadgeContentType,
  CairaCategory,
  CairaLevel,
} from '../../../../../shared/core/models/caira/cpe.model';

describe('TrackerToolbar', () => {
  let component: TrackerToolbar;
  let fixture: ComponentFixture<TrackerToolbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackerToolbar],
    }).compileComponents();

    fixture = TestBed.createComponent(TrackerToolbar);
    fixture.componentRef.setInput('category', 'CAIRA');
    fixture.componentRef.setInput('level', 'L1');
    fixture.componentRef.setInput('contentType', 'Masterclass');
    fixture.componentRef.setInput('contentTypeOptions', ['Masterclass', 'Webinar']);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits levelChange when the level select is changed', async () => {
    const captured: CairaLevel[] = [];
    component.levelChange.subscribe((v) => captured.push(v));

    const selects = (fixture.nativeElement as HTMLElement).querySelectorAll('select');
    const levelSelect = selects[0] as HTMLSelectElement;
    levelSelect.value = 'L2';
    levelSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(captured).toEqual(['L2']);
  });

  it('emits contentTypeChange when the content-type select is changed', async () => {
    const captured: BadgeContentType[] = [];
    component.contentTypeChange.subscribe((v) => captured.push(v));

    const selects = (fixture.nativeElement as HTMLElement).querySelectorAll('select');
    const typeSelect = selects[1] as HTMLSelectElement;
    typeSelect.value = 'Webinar';
    typeSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(captured).toEqual(['Webinar']);
  });

  it('hides the level selector for NON-CAIRA, which has no level concept', async () => {
    fixture.componentRef.setInput('category', 'NON-CAIRA');
    await fixture.whenStable();

    // Only the content-type select remains.
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('select')).toHaveLength(1);
  });

  it('emits categoryChange from the segmented toggle', async () => {
    const captured: CairaCategory[] = [];
    component.categoryChange.subscribe((v) => captured.push(v));

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '[role="group"] button',
    );
    (buttons[1] as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(captured).toEqual(['NON-CAIRA']);
  });

  it('disables the content-type select when nothing matches the filter', async () => {
    fixture.componentRef.setInput('contentTypeOptions', []);
    await fixture.whenStable();

    const selects = (fixture.nativeElement as HTMLElement).querySelectorAll('select');
    expect((selects[selects.length - 1] as HTMLSelectElement).disabled).toBe(true);
  });
});
