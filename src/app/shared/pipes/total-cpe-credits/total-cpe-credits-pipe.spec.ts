import { TotalCpeCreditsPipe } from './total-cpe-credits-pipe';

describe('TotalCpeCreditsPipe', () => {
  const pipe = new TotalCpeCreditsPipe();

  it('sums per-field credits', () => {
    expect(pipe.transform([{ id: 1, name: 'IT', cpe_credits: 0.5 }], 2)).toBe(0.5);
  });

  it('falls back to class_credits when fields carry no credits', () => {
    expect(pipe.transform([{ id: 45, name: 'IT' }], 0.5)).toBe(0.5);
  });

  it('falls back when there are no fields', () => {
    expect(pipe.transform([], 0.5)).toBe(0.5);
    expect(pipe.transform(null, 0.5)).toBe(0.5);
  });
});
