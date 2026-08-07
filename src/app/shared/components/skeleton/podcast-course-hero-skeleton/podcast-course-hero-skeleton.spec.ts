import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PodcastCourseHeroSkeleton } from './podcast-course-hero-skeleton';

describe('PodcastCourseHeroSkeleton', () => {
  let component: PodcastCourseHeroSkeleton;
  let fixture: ComponentFixture<PodcastCourseHeroSkeleton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PodcastCourseHeroSkeleton],
    }).compileComponents();

    fixture = TestBed.createComponent(PodcastCourseHeroSkeleton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
