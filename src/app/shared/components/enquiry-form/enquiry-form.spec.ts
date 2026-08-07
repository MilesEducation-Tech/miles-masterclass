import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnquiryForm } from './enquiry-form';

describe('EnquiryForm', () => {
  let component: EnquiryForm;
  let fixture: ComponentFixture<EnquiryForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnquiryForm],
    }).compileComponents();

    fixture = TestBed.createComponent(EnquiryForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
