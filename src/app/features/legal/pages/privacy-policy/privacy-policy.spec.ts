import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PrivacyPolicy } from './privacy-policy';

describe('PrivacyPolicy', () => {
  let component: PrivacyPolicy;
  let fixture: ComponentFixture<PrivacyPolicy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyPolicy],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacyPolicy);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should resolve a Privacy Policy doc for the active locale', () => {
    const doc = component['doc']();
    expect(doc.slug).toBe('privacy-policy');
    expect(doc.sections.length).toBeGreaterThan(0);
  });
});
