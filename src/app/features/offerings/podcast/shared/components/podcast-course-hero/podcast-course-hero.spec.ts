import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PodcastCourseHero } from './podcast-course-hero';

describe('PodcastCourseHero', () => {
  let component: PodcastCourseHero;
  let fixture: ComponentFixture<PodcastCourseHero>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PodcastCourseHero],
    }).compileComponents();

    fixture = TestBed.createComponent(PodcastCourseHero);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
