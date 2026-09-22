import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HtmlContentDialog } from './html-content-dialog';
import { MockDialogRef } from '../../../../testing/mocks/dialog.mock';

describe('HtmlContentDialog', () => {
  let component: HtmlContentDialog;
  let fixture: ComponentFixture<HtmlContentDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HtmlContentDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlContentDialog);
    component = fixture.componentInstance;
    component.dialogRef = new MockDialogRef() as unknown as HtmlContentDialog['dialogRef'];
    component.data = {
      title: 'Learning objectives',
      htmlContent: '<p>Understand the core CPA exam sections.</p>',
    };
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
