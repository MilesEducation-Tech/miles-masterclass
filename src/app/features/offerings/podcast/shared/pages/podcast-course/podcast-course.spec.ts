import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PodcastCourse } from './podcast-course';

describe('PodcastCourse', () => {
  let component: PodcastCourse;
  let fixture: ComponentFixture<PodcastCourse>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PodcastCourse],
    }).compileComponents();

    fixture = TestBed.createComponent(PodcastCourse);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
