import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoListWrapper } from './video-list-wrapper';

describe('VideoListWrapper', () => {
  let component: VideoListWrapper;
  let fixture: ComponentFixture<VideoListWrapper>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoListWrapper],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoListWrapper);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
