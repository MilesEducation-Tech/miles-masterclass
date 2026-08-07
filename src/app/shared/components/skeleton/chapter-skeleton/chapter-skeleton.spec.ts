import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChapterSkeleton } from './chapter-skeleton';

describe('ChapterSkeleton', () => {
  let component: ChapterSkeleton;
  let fixture: ComponentFixture<ChapterSkeleton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChapterSkeleton],
    }).compileComponents();

    fixture = TestBed.createComponent(ChapterSkeleton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
