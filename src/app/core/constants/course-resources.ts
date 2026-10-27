import { environment } from '@env/environment';
import { RouteConfig } from '@core/models/http.model';

/**
 * The AI Kit button's read: the kit and exercise files sit in the course
 * detail's `miscellaneous_data`. `pre_login` for everyone: the extras are
 * public, and the signed-in variant adds nothing they need.
 */
export const COURSE_RESOURCES_ROUTE = {
  path: `${environment.BASE_API_URL}web-api/v1/masterclass/course-detail/:id/`,
  method: 'GET',
} as RouteConfig<void, unknown, Record<string, string>, { login_type: 'pre_login' }>;

/** The "Additional Resources" dialog and its toasts. */
export const COURSE_RESOURCES_COPY = {
  title: 'Additional Resources',
  aiKit: 'AI Kit',
  exerciseFile: 'Exercise file',
  emptyTitle: 'No Resources',
  emptyMessage: 'No additional resources are available for this course.',
  errorTitle: 'Error',
  errorMessage: 'Failed to fetch additional resources. Please try again later.',
} as const;
