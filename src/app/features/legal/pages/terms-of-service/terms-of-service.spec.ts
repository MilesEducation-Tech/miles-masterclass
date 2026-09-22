import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TermsOfService } from './terms-of-service';

describe('TermsOfService', () => {
  let component: TermsOfService;
  let fixture: ComponentFixture<TermsOfService>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TermsOfService],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TermsOfService);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should resolve a Terms of Service doc for the active locale', () => {
    const doc = component['doc']();
    expect(doc.slug).toBe('terms-of-service');
    expect(doc.sections.length).toBeGreaterThan(0);
  });
});
