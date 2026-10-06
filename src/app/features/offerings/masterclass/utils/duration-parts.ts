import { MasterclassDurationParts } from '@features/offerings/masterclass/models/masterclass-course.model';

const HOURS = /(\d+)\s*hours?\b/i;
const MINUTES = /(\d+)\s*minutes?\b/i;

/**
 * Split the API's preformatted `total_duration` ("1 hour 34 minutes", "3 Hours")
 * into the About grid's two cells. `null` when neither unit is found, so the
 * page shows the API's own wording rather than a wrong "0 Hours 0 Mins".
 */
export function durationParts(text: string): MasterclassDurationParts | null {
  const hours = HOURS.exec(text);
  const minutes = MINUTES.exec(text);
  if (!hours && !minutes) return null;
  return {
    hours: hours ? Number(hours[1]) : 0,
    minutes: minutes ? Number(minutes[1]) : 0,
  };
}
