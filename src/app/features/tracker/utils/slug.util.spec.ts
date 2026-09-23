import { toSlug } from './slug.util';

describe('toSlug', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(toSlug('Hello World')).toBe('hello-world');
  });

  it('strips punctuation', () => {
    expect(toSlug('CPE Credits: Q4/2026!')).toBe('cpe-credits-q42026');
  });

  it('collapses consecutive dashes', () => {
    expect(toSlug('foo   -- bar')).toBe('foo-bar');
  });

  it('trims whitespace at the edges', () => {
    expect(toSlug('   padded name   ')).toBe('padded-name');
  });
});
