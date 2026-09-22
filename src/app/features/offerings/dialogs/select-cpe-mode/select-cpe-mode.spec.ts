import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectCpeMode } from './select-cpe-mode';
import { MockDialogRef } from '@testing/mocks/dialog.mock';

describe('SelectCpeMode', () => {
  let component: SelectCpeMode;
  let fixture: ComponentFixture<SelectCpeMode>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectCpeMode],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectCpeMode);
    component = fixture.componentInstance;
    component.dialogRef = new MockDialogRef() as unknown as SelectCpeMode['dialogRef'];
    component.data = { type: 'Masterclass', format: 'video', isFree: false };
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
