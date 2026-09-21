import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChapterQuiz } from './chapter-quiz';

describe('ChapterQuiz', () => {
  let component: ChapterQuiz;
  let fixture: ComponentFixture<ChapterQuiz>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChapterQuiz],
    }).compileComponents();

    fixture = TestBed.createComponent(ChapterQuiz);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
