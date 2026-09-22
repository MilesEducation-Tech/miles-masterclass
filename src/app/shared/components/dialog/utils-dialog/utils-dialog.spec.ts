import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UtilsDialog } from './utils-dialog';
import { MockDialogRef } from '../../../../testing/mocks/dialog.mock';

describe('UtilsDialog', () => {
  let component: UtilsDialog;
  let fixture: ComponentFixture<UtilsDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UtilsDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(UtilsDialog);
    component = fixture.componentInstance;
    // `Dialog.open()` assigns `dialogRef` and `data` onto the instance after
    // creating it — there is no injection token — so a spec has to do the same
    // before the first change detection.
    component.dialogRef = new MockDialogRef() as unknown as UtilsDialog['dialogRef'];
    component.data = {
      title: 'Remove from cart',
      containerClass: '',
      content: [{ type: 'text', value: 'Are you sure you want to remove this course?' }],
      buttons: [
        { label: 'Cancel', variant: 'outline', action: 'cancel' },
        { label: 'Confirm', variant: 'default', action: 'confirm' },
      ],
    };
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
