import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoChapter } from './video-chapter';

describe('VideoChapter', () => {
  let component: VideoChapter;
  let fixture: ComponentFixture<VideoChapter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoChapter],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoChapter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
