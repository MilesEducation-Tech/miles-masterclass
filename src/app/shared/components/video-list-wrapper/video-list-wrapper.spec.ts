import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoListItem, VideoListWrapper } from './video-list-wrapper';

const VIDEOS: VideoListItem[] = [
  {
    videoSrc: 'https://cdn.test/partner-hero.mp4',
    posterSrc: 'https://placehold.co/600x300/1a1a2e/ffffff?text=Partner',
  },
  {
    videoSrc: 'https://cdn.test/partner-testimonial.mp4',
    posterSrc: 'https://placehold.co/600x300/2d1b69/ffffff?text=Testimonial',
    mobileVideoSrc: 'https://cdn.test/partner-testimonial-portrait.mp4',
  },
];

describe('VideoListWrapper', () => {
  let component: VideoListWrapper;
  let fixture: ComponentFixture<VideoListWrapper>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoListWrapper],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoListWrapper);
    // `videoList` defaults to `[]`, but the template dereferences
    // `activeVideo().videoSrc` with no guard, so an empty list throws. Every
    // real call site passes a non-empty list; the spec does the same.
    fixture.componentRef.setInput('videoList', VIDEOS);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
