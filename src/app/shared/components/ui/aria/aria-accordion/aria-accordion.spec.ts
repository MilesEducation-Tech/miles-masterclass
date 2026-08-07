import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AriaAccordionGroup } from './aria-accordion-group';

describe('AriaAccordionGroup', () => {
  let component: AriaAccordionGroup;
  let fixture: ComponentFixture<AriaAccordionGroup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AriaAccordionGroup],
    }).compileComponents();

    fixture = TestBed.createComponent(AriaAccordionGroup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
