import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HtmlContentDialog } from './html-content-dialog';

describe('HtmlContentDialog', () => {
  let component: HtmlContentDialog;
  let fixture: ComponentFixture<HtmlContentDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HtmlContentDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlContentDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
