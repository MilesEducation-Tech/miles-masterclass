import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoPoster } from './video-poster';

describe('VideoPoster', () => {
  let component: VideoPoster;
  let fixture: ComponentFixture<VideoPoster>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoPoster],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoPoster);
    // Both sources are `input.required` — the poster is not a fallback here.
    fixture.componentRef.setInput('videoSrc', 'https://cdn.test/trailer.mp4');
    fixture.componentRef.setInput(
      'posterSrc',
      'https://placehold.co/600x300/1a1a2e/ffffff?text=Trailer',
    );
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
