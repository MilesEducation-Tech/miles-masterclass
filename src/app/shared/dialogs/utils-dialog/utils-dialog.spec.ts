import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgpDialogRef } from 'ng-primitives/dialog';

import { UtilsDialog, UtilsDialogData } from './utils-dialog';
import { provideMockDialogRef, stubDialogShell } from '@testing/mocks/dialog-ref.mock';

const DATA: UtilsDialogData = {
  title: 'Remove from cart',
  containerClass: '',
  content: [{ type: 'text', value: 'Are you sure you want to remove this course?' }],
  buttons: [
    { label: 'Cancel', variant: 'outline', action: 'cancel' },
    { label: 'Confirm', variant: 'default', action: 'confirm' },
  ],
};

describe('UtilsDialog', () => {
  let component: UtilsDialog;
  let fixture: ComponentFixture<UtilsDialog>;

  beforeEach(async () => {
    stubDialogShell(UtilsDialog);
    await TestBed.configureTestingModule({
      imports: [UtilsDialog],
      providers: [provideMockDialogRef(DATA)],
    }).compileComponents();

    fixture = TestBed.createComponent(UtilsDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('closes with the confirm result', () => {
    component.handleButtonClick('confirm');
    expect(TestBed.inject(NgpDialogRef).close).toHaveBeenCalledWith({
      action: 'confirm',
      result: true,
    });
  });
});
