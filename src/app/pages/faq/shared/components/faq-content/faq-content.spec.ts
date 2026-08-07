import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FaqContent } from './faq-content';

describe('FaqContent', () => {
  let component: FaqContent;
  let fixture: ComponentFixture<FaqContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaqContent],
    }).compileComponents();

    fixture = TestBed.createComponent(FaqContent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
