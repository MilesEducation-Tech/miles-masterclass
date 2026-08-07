import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AudioChapter } from './audio-chapter';

describe('AudioChapter', () => {
  let component: AudioChapter;
  let fixture: ComponentFixture<AudioChapter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioChapter],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioChapter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
