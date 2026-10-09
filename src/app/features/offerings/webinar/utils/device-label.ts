import {
  DEVICE_BROWSERS,
  DEVICE_LABEL_FALLBACK,
  DEVICE_LABEL_MAX_LENGTH,
  DEVICE_SYSTEMS,
} from '@features/offerings/webinar/constants/live-session';
import { DeviceMatcher } from '@features/offerings/webinar/models/meeting-session.model';

const firstMatch = (userAgent: string, table: readonly DeviceMatcher[]): string | null =>
  table.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;

/**
 * "Chrome on macOS": how this device is named in the conflict dialog on the
 * learner's OTHER device. It describes the device, never the person, and only
 * the same learner ever sees it.
 */
export function deviceLabel(userAgent: string): string {
  const browser = firstMatch(userAgent, DEVICE_BROWSERS);
  const system = firstMatch(userAgent, DEVICE_SYSTEMS);
  const label = system
    ? `${browser ?? 'Browser'} on ${system}`
    : (browser ?? DEVICE_LABEL_FALLBACK);
  return label.slice(0, DEVICE_LABEL_MAX_LENGTH);
}
