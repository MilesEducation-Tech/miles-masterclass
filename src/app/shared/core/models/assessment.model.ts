import { ContentDetails, FinalAssessmentExamResponse, QuizQuestion } from './course.model';
import { CommonResponse, RouteConfig } from './http.model';

export const ASSESSMENT_ROUTES = {
  getCourseDetails: {
    path: 'v2/:course_type/details/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<ContentDetails>, {}, { id: number }>,

  startFinalAssessment: {
    path: 'user-assessment/start_assessment/',
    method: 'POST',
  } as RouteConfig<
    void,
    FinalAssessmentExamResponse,
    {},
    { masterclass_id?: number; podcast_id?: number; nano_learning_id?: number }
  >,

  getFinalAssessmentQuestions: {
    path: 'final-assessment/',
    method: 'GET',
  } as RouteConfig<
    void,
    CommonResponse<QuizQuestion[]>,
    {},
    { masterclass_id?: number; podcast_id?: number; nano_learning_id?: number; session_id: number }
  >,

  submitFinalAssessment: {
    path: 'user-assessment/',
    method: 'POST',
  } as RouteConfig<SubmitFinalAssessmentRequest, SubmitFinalAssessmentResponse>,

  finalAssessmentReport: {
    path: 'user-assessment/assessment_report/',
    method: 'POST',
  } as RouteConfig<{ userassessment_id: number }, SubmitFinalAssessmentResponse>,
} as const;

export interface SubmitFinalAssessmentRequest {
  masterclass_id?: number;
  course_id?: number;
  podcast_id?: number;
  nano_learning_id?: number;
  session_id: number;
  answers_list: { question_id: number; answer: string }[];
}

// MAY CHANGE
export interface SubmitFinalAssessmentResponse {
  status_code: true;
  data: {
    id: number;
    question_answers: {
      id: number;
      question_object: {
        id: number;
        status: true;
        option_a: string;
        option_b: string;
        option_c: string;
        option_d: string;
        question: string;
        correct_option: string;
        description_option_a: string;
        description_option_b: string;
        description_option_c: string;
        description_option_d: string;
      };
      answer: string;
      is_correct: boolean;
      question: number;
      assessment: number;
      updated_by: null;
    }[];
    result_details: {
      total_percentage: number;
      pass_percentage: number;
      my_percentage: number;
    };
    is_submitted: boolean;
    is_passed: boolean;
    total_questions: number;
    total_correct: number;
    question_lists: number[];
    user_session_data: string | null;
    exam_passes_date: string;
    masterclass: number;
    nano_learning: number | null;
    user: number;
    updated_by: number | null;
  };
}
