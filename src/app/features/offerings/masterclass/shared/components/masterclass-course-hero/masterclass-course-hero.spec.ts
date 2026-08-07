import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MasterclassCourseHero } from './masterclass-course-hero';

describe('MasterclassCourseHero', () => {
  let component: MasterclassCourseHero;
  let fixture: ComponentFixture<MasterclassCourseHero>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MasterclassCourseHero],
    }).compileComponents();

    fixture = TestBed.createComponent(MasterclassCourseHero);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
