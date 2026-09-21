import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EnquiryForm } from './enquiry-form';

describe('EnquiryForm', () => {
  let component: EnquiryForm;
  let fixture: ComponentFixture<EnquiryForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnquiryForm],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(EnquiryForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
