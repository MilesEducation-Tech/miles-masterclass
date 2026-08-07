import { badgeHaloHex, badgeLevelGradient, badgeProgressGradient } from './badge-level';

describe('badge-level helpers', () => {
  describe('badgeLevelGradient', () => {
    it('returns bronze for rank 1', () => {
      expect(badgeLevelGradient(1)).toBe('from-[#BB9253] to-[#9C7337] stroke-[#321A04]');
    });

    it('returns silver for rank 2', () => {
      expect(badgeLevelGradient(2)).toBe('from-[#CFD0D0] to-[#8F9092] stroke-[#2F2F31]');
    });

    it('returns gold for rank 3', () => {
      expect(badgeLevelGradient(3)).toBe('from-[#ECD67F] to-[#B28332] stroke-[#322205]');
    });

    it('falls back to bronze for null / 0 / unknown ranks', () => {
      const bronze = 'from-[#BB9253] to-[#9C7337] stroke-[#321A04]';
      expect(badgeLevelGradient(null)).toBe(bronze);
      expect(badgeLevelGradient(undefined)).toBe(bronze);
      expect(badgeLevelGradient(0)).toBe(bronze);
      expect(badgeLevelGradient(42)).toBe(bronze);
    });
  });

  describe('badgeProgressGradient', () => {
    it('mirrors the headline gradient palette per rank', () => {
      expect(badgeProgressGradient(1)).toBe('from-[#9C7036] to-[#552C02]');
      expect(badgeProgressGradient(2)).toBe('from-[#ABADB1] to-[#4C4D52]');
      expect(badgeProgressGradient(3)).toBe('from-[#D9AA3B] to-[#BC8C1E]');
      expect(badgeProgressGradient(null)).toBe('from-[#9C7036] to-[#552C02]');
    });
  });

  describe('badgeHaloHex', () => {
    it('returns the halo hex per rank', () => {
      expect(badgeHaloHex(1)).toBe('#BB9253');
      expect(badgeHaloHex(2)).toBe('#CFD0D0');
      expect(badgeHaloHex(3)).toBe('#ECD67F');
      expect(badgeHaloHex(null)).toBe('#BB9253');
    });
  });
});
