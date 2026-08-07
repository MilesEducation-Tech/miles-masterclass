import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PodcastChapter } from './podcast-chapter';

describe('PodcastChapter', () => {
  let component: PodcastChapter;
  let fixture: ComponentFixture<PodcastChapter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PodcastChapter],
    }).compileComponents();

    fixture = TestBed.createComponent(PodcastChapter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
