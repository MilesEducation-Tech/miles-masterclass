import { Toast } from '@core/models/notification.model';

export const MOCK_SUCCESS_TOAST: Toast = {
  id: 'toast-1',
  type: 'success',
  title: 'Success',
  message: 'Your progress has been saved successfully.',
  duration: 5000,
  closable: true,
  position: 'top-right',
};

export const MOCK_ERROR_TOAST: Toast = {
  id: 'toast-2',
  type: 'error',
  title: 'Error',
  message: 'Failed to load course content. Please try again.',
  duration: 5000,
  closable: true,
  position: 'top-right',
};

export const MOCK_INFO_TOAST: Toast = {
  id: 'toast-3',
  type: 'info',
  title: 'Info',
  message: 'New course content is available. Refresh to see updates.',
  duration: 5000,
  closable: true,
  position: 'top-right',
};
