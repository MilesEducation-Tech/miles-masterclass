import {
  formatCountdown,
  formatCountdownLong,
  formatStartsIn,
  splitDuration,
} from './session-time';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatCountdownLong', () => {
  it('reads as a sentence fragment, two units at most', () => {
    expect(formatCountdownLong(splitDuration(4 * DAY + 3 * HOUR))).toBe('4 days and 3 hours');
    expect(formatCountdownLong(splitDuration(4 * HOUR + 30 * MIN))).toBe('4 hours and 30 minutes');
  });

  it('drops a zero second unit rather than saying "and 0 hours"', () => {
    expect(formatCountdownLong(splitDuration(4 * DAY))).toBe('4 days');
    expect(formatCountdownLong(splitDuration(2 * HOUR))).toBe('2 hours');
  });

  it('singularises', () => {
    expect(formatCountdownLong(splitDuration(DAY + HOUR))).toBe('1 day and 1 hour');
    expect(formatCountdownLong(splitDuration(MIN))).toBe('1 minute');
    expect(formatCountdownLong(splitDuration(1000))).toBe('1 second');
  });

  it('adds seconds only inside the last five minutes, where they matter', () => {
    expect(formatCountdownLong(splitDuration(30 * MIN))).toBe('30 minutes');
    expect(formatCountdownLong(splitDuration(2 * MIN + 30_000))).toBe('2 minutes and 30 seconds');
  });

  it('clamps at zero — a countdown never counts up', () => {
    expect(formatCountdownLong(splitDuration(-5000))).toBe('0 seconds');
  });

  it('leaves the compact form alone, which cards still use', () => {
    expect(formatCountdown(splitDuration(4 * DAY + 3 * HOUR))).toBe('4d 03h');
    expect(formatCountdown(splitDuration(4 * HOUR + 30 * MIN))).toBe('4h 30m');
  });
});

describe('formatStartsIn', () => {
  it('names one unit, rounded down', () => {
    expect(formatStartsIn(3 * 86_400_000 + 3_600_000)).toBe('3 days');
    expect(formatStartsIn(2 * 3_600_000 + 60_000)).toBe('2 hrs');
    expect(formatStartsIn(5 * 60_000 + 30_000)).toBe('5 min');
  });

  it('singularises and never says 0 min', () => {
    expect(formatStartsIn(86_400_000)).toBe('1 day');
    expect(formatStartsIn(3_600_000)).toBe('1 hr');
    expect(formatStartsIn(20_000)).toBe('1 min');
  });

  it('is null once the moment has passed, so the chip disappears', () => {
    expect(formatStartsIn(0)).toBeNull();
    expect(formatStartsIn(-1)).toBeNull();
  });
});
