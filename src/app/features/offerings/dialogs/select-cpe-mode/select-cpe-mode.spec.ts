import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockDialogRef, stubDialogShell } from '@testing/mocks/dialog-ref.mock';

import { SelectCpeMode } from './select-cpe-mode';

describe('SelectCpeMode', () => {
  let component: SelectCpeMode;
  let fixture: ComponentFixture<SelectCpeMode>;

  beforeEach(async () => {
    stubDialogShell(SelectCpeMode);
    await TestBed.configureTestingModule({
      imports: [SelectCpeMode],
      providers: [provideMockDialogRef({ type: 'Masterclass', format: 'video', isFree: false })],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectCpeMode);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
