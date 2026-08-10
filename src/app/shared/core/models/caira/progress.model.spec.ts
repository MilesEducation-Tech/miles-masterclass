import { chapterNavigation, isResetRequired, toChapterProgress } from './progress.model';

const chapter = (id: string) => ({ id });

describe('isResetRequired', () => {
  it('matches only the literal true flag', () => {
    // Every consumer branches on this before reading any other key, because the
    // reset body carries none of them.
    expect(isResetRequired({ reset_required: true })).toBe(true);
    expect(isResetRequired({ reset_required: false })).toBe(false);
    expect(isResetRequired({ reset_required: 'true' })).toBe(false);
    expect(isResetRequired({})).toBe(false);
    expect(isResetRequired(null)).toBe(false);
    expect(isResetRequired(undefined)).toBe(false);
  });
});

describe('chapterNavigation', () => {
  const chapters = [chapter('a'), chapter('b'), chapter('c')];

  it('returns the triple around the current chapter', () => {
    expect(chapterNavigation(chapters, 'b')).toEqual({
      current: chapters[1],
      prev: chapters[0],
      next: chapters[2],
      currentIndex: 1,
    });
  });

  it('reports no prev at the start and no next at the end', () => {
    expect(chapterNavigation(chapters, 'a').prev).toBeNull();
    expect(chapterNavigation(chapters, 'a').next).toBe(chapters[1]);
    expect(chapterNavigation(chapters, 'c').next).toBeNull();
  });

  it('never returns null for the whole object', () => {
    // The placeholder this replaces returned `null`, and the template reads
    // `navigation().current` — which crashed the page on render.
    expect(chapterNavigation(chapters, 'missing')).toEqual({
      current: null,
      prev: null,
      next: null,
      currentIndex: -1,
    });
    expect(chapterNavigation([], 'a').current).toBeNull();
    expect(chapterNavigation(chapters, null).current).toBeNull();
  });

  it('handles a single-chapter course', () => {
    const one = [chapter('only')];
    expect(chapterNavigation(one, 'only')).toEqual({
      current: one[0],
      prev: null,
      next: null,
      currentIndex: 0,
    });
  });
});

describe('toChapterProgress', () => {
  it('unwraps the success envelope', () => {
    expect(
      toChapterProgress({ status: 'success', data: { chapter_id: 'a', is_video_completed: true } }),
    ).toEqual({ chapter_id: 'a', is_video_completed: true });
  });

  it('reports null on the reset branch rather than reading absent keys', () => {
    expect(toChapterProgress({ reset_required: true })).toBeNull();
  });

  it('reports null for nothing', () => {
    expect(toChapterProgress(undefined)).toBeNull();
  });
});
