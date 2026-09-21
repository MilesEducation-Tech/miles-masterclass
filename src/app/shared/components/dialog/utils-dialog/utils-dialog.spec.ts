import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UtilsDialog } from './utils-dialog';

describe('UtilsDialog', () => {
  let component: UtilsDialog;
  let fixture: ComponentFixture<UtilsDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UtilsDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(UtilsDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
