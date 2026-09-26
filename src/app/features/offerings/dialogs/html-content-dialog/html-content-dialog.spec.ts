import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockDialogRef, stubDialogShell } from '@testing/mocks/dialog-ref.mock';

import { HtmlContentDialog } from './html-content-dialog';

describe('HtmlContentDialog', () => {
  let component: HtmlContentDialog;
  let fixture: ComponentFixture<HtmlContentDialog>;

  beforeEach(async () => {
    stubDialogShell(HtmlContentDialog);
    await TestBed.configureTestingModule({
      imports: [HtmlContentDialog],
      providers: [
        provideMockDialogRef({
          title: 'Learning objectives',
          htmlContent: '<p>Understand the core CPA exam sections.</p>',
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlContentDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
