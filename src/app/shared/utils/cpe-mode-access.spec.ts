import { canAccessCpeMode } from './cpe-mode-access';

describe('canAccessCpeMode', () => {
  const paid = { is_free: false, active_plan: null };

  it('allows a subscriber on paid content', () => {
    expect(canAccessCpeMode(paid, true)).toBe(true);
  });

  it('allows free content without a plan', () => {
    expect(canAccessCpeMode({ ...paid, is_free: true }, false)).toBe(true);
  });

  it('allows individually-purchased content without a plan', () => {
    expect(canAccessCpeMode({ ...paid, active_plan: { id: 1 } }, false)).toBe(true);
  });

  it('blocks paid content without a plan', () => {
    expect(canAccessCpeMode(paid, false)).toBe(false);
  });

  // Reels ship neither field. Absent must read as "not exempt", not as truthy.
  it('blocks content that omits both exemption fields', () => {
    expect(canAccessCpeMode({}, false)).toBe(false);
  });
});
