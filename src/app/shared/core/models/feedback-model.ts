import { ContentDetails } from './course.model';
import { CommonResponse, RouteConfig } from './http.model';

export const FEEDBACK_ROUTES = {
  getCourseDetails: {
    path: 'v2/:course_type/details/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<ContentDetails>, {}, { id: number }>,
  getFeedbackCategory: {
    path: 'feedback-category/',
    method: 'GET',
  } as RouteConfig<void, FeedbackListResponse, {}, {}>,
  submitFeedback: {
    path: 'user-feedback/submit_feedback/',
    method: 'POST',
  } as RouteConfig<FeedbackRequest, FeedbackSubmitResponse, {}, {}>,
  userFeedback: {
    path: 'user-feedback/',
    method: 'GET',
  } as RouteConfig<void, UserFeedbackResponse, {}, { master_class__id: number }>,
} as const;

export interface FeedbackCategory {
  id: number;
  feedback_category: string;
}

export interface FeedbackSubmissionItem {
  feedback_category: number;
  feedback: number;
}

export interface FeedbackRequest {
  feedbacks: FeedbackSubmissionItem[];
  other_comments: string;
  masterclass_id?: string;
  podcast_id?: string;
  nano_learning_id?: string;
}

export interface CertificateUrls {
  miles_certificate_url: string;
  version_number: number;
  nasba_certificate_url: string;
}

export interface FeedbackListResponse {
  status_code: number;
  data: FeedbackCategory[];
  message: string;
}

export interface FeedbackSubmitResponse {
  status_code: boolean | number;
  message: string;
  URL?: CertificateUrls;
}

export interface FeedbackDetail {
  id: number;
  category_details: {
    id: number;
    feedback_category: string;
  };
  feedback_answer: number;
  user_feedback: number;
  feedback_category: number;
  updated_by: number | null;
}

export interface UserFeedbackData {
  id: number;
  feedback_details: FeedbackDetail[];
  other_comments: string;
  master_class: number;
  nano_learning: number | null;
  webinar: number | null;
  manual_webinar: number | null;
  user: number;
  updated_by: number | null;
}

export interface UserFeedbackResponse {
  status_code: number;
  data: UserFeedbackData[];
  message: string;
}
