import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { PartnershipContentInput, PartnershipContent } from './partnership-content';

const CONTENT: PartnershipContentInput[] = [
  { type: 'MASTERCLASS', heading: 'Masterclasses', subheading: 'Accredited multi-chapter courses' },
  { type: 'PODCAST', heading: 'Podcasts' },
];

describe('PartnershipContent', () => {
  let component: PartnershipContent;
  let fixture: ComponentFixture<PartnershipContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartnershipContent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(PartnershipContent);
    fixture.componentRef.setInput('content', CONTENT);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
