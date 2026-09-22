import { Pipe, PipeTransform } from '@angular/core';

/**
 * Duration display format options:
 * - 'hh:mm:ss'    → "01:30:45" or "30:45" (hides hours if zero)
 * - 'mm:ss'       → "90:45" or "0:45" (minutes can exceed 59, hides if zero)
 * - 'auto'        → "1:30:45" or "30:45" (hides hours if zero)
 * - 'short'       → "1h 30m 45s" (compact text, omits zero parts)
 * - 'medium'      → "1 hr 30 min 45 sec" (omits zero parts)
 * - 'long'        → "1 hour 30 minutes 45 seconds" (omits zero parts)
 * - 'humanized'   → "1 hour, 30 minutes" (omits zero values)
 * - 'compact'     → "1:30" (hours:minutes, no seconds)
 */
export type DurationFormat =
  'hh:mm:ss' | 'mm:ss' | 'auto' | 'short' | 'medium' | 'long' | 'humanized' | 'compact';

@Pipe({
  name: 'duration',
})
export class DurationPipe implements PipeTransform {
  /**
   * Transforms a duration value (in seconds) to a human-readable format.
   * @param value - Duration in seconds (number or string)
   * @param format - Display format (default: 'auto')
   * @returns Formatted duration string
   */
  transform(value: number | string | null | undefined, format: DurationFormat = 'auto'): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const totalSeconds = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(totalSeconds) || totalSeconds < 0) {
      return '';
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    switch (format) {
      case 'hh:mm:ss':
        return this.formatTime(hours, minutes, seconds, true);

      case 'mm:ss':
        return this.formatMinutesSeconds(totalSeconds);

      case 'auto':
        return this.formatTime(hours, minutes, seconds, false);

      case 'short':
        return this.formatShort(hours, minutes, seconds);

      case 'medium':
        return this.formatMedium(hours, minutes, seconds);

      case 'long':
        return this.formatLong(hours, minutes, seconds);

      case 'humanized':
        return this.formatHumanized(hours, minutes, seconds);

      case 'compact':
        return this.formatCompact(hours, minutes);

      default:
        return this.formatTime(hours, minutes, seconds, false);
    }
  }

  private padZero(num: number): string {
    return num.toString().padStart(2, '0');
  }

  private formatTime(hours: number, minutes: number, seconds: number, padHours: boolean): string {
    if (hours > 0) {
      return `${padHours ? this.padZero(hours) : hours}:${this.padZero(minutes)}:${this.padZero(
        seconds,
      )}`;
    }
    return `${minutes}:${this.padZero(seconds)}`;
  }

  private formatMinutesSeconds(totalSeconds: number): string {
    const totalMinutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${totalMinutes}:${this.padZero(seconds)}`;
  }

  private formatShort(hours: number, minutes: number, seconds: number): string {
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  }

  private formatMedium(hours: number, minutes: number, seconds: number): string {
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours} hr`);
    if (minutes > 0) parts.push(`${minutes} min`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} sec`);
    return parts.join(' ');
  }

  private formatLong(hours: number, minutes: number, seconds: number): string {
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    if (seconds > 0 || parts.length === 0)
      parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
    return parts.join(' ');
  }

  private formatHumanized(hours: number, minutes: number, seconds: number): string {
    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    }

    if (minutes > 0) {
      parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    }

    // Only show seconds if no hours/minutes, or if it's the only value
    if (parts.length === 0) {
      parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
    }

    return parts.join(', ');
  }

  private formatCompact(hours: number, minutes: number): string {
    if (hours > 0) {
      return `${hours}:${this.padZero(minutes)}`;
    }
    return `${minutes} min`;
  }
}
