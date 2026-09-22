import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { ChapterQuiz } from './chapter-quiz';
import { ChapterFacade } from '../../services/chapter-facade/chapter-facade';
import { CourseChapter, QuizQuestion } from '@core/models/course.model';

const QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    updated_at: '2025-06-01T00:00:00Z',
    question: 'Which statement reports cash movement over a period?',
    option_a: 'Balance sheet',
    description_option_a: 'A point-in-time position, not a period.',
    option_b: 'Cash flow statement',
    description_option_b: 'Correct — it covers a period.',
    option_c: 'Income statement',
    description_option_c: 'Reports profit, not cash.',
    option_d: 'Statement of equity',
    description_option_d: 'Reports ownership changes.',
    status: true,
    updated_by: null,
    chapter: 501,
  },
];

const CHAPTER: CourseChapter = {
  id: 501,
  play_history: null,
  quiz_details: {
    questions: QUESTIONS,
    already_attended: 0,
    total_questions: 1,
    overall_chapter_questions: 1,
  },
  updated_at: '2025-06-01T00:00:00Z',
  chapter_name: 'Reading the cash flow statement',
  chapter_thumbnail: 'https://placehold.co/600x300/1a1a2e/ffffff?text=Chapter+1',
  square_thumbnail: null,
  description: 'Where the cash actually went.',
  transcript_source: null,
  transcript: null,
  transcript_text: null,
  video_source: null,
  video_url: 'https://cdn.test/chapter-1.m3u8',
  audio_url: null,
  mobile_video_url: 'https://cdn.test/chapter-1-mobile.m3u8',
  no_of_questions: 1,
  video_duration: 600,
  start_page: 1,
  end_page: 12,
  course_created_date: null,
  course_reviewed_date: null,
  course_updated_date: null,
  updated_by: null,
  master_class: 101,
  nano_learning: 0,
};

describe('ChapterQuiz', () => {
  let component: ChapterQuiz;
  let fixture: ComponentFixture<ChapterQuiz>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChapterQuiz],
      providers: [
        // Route-scoped, not `providedIn: 'root'` — it is listed in a route's
        // `providers`, so a spec has to provide it by hand.
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ChapterFacade,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChapterQuiz);
    fixture.componentRef.setInput('questions', QUESTIONS);
    fixture.componentRef.setInput('current', CHAPTER);
    fixture.componentRef.setInput('chapterId', CHAPTER.id);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
