import { TestBed } from '@angular/core/testing';
import { BadgeItem } from '../../../core/models/cpe-tracker.model';
import { BadgeHeroCard } from './badge-hero-card';

function makeBadge(overrides: Partial<BadgeItem> = {}): BadgeItem {
  return {
    id: 1,
    name: 'CAIRA — Level 1',
    sub_text: 'Foundations of AI in Accounting',
    description: 'Gain a solid foundation in AI for accounting workflows.',
    image_url: 'https://cdn/level1.webp',
    level: 'Level 1',
    level_rank: 1,
    required_credits: 30,
    earned_credits: 10,
    progress_percentage: 33,
    status: 'unlocked',
    is_claimed: false,
    is_claimable: false,
    is_coming_soon: false,
    ...overrides,
  };
}

describe('BadgeHeroCard', () => {
  function render(badge: BadgeItem, layout: 'hero' | 'grid' = 'hero') {
    const fixture = TestBed.createComponent(BadgeHeroCard);
    fixture.componentRef.setInput('badge', badge);
    fixture.componentRef.setInput('layout', layout);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the "Coming Soon" pill and no CTA when is_coming_soon', () => {
    const fixture = render(
      makeBadge({ is_coming_soon: true, is_claimable: false, is_claimed: false }),
    );
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Coming Soon');
    expect(text).not.toContain('Share Badge');
    expect(text).not.toContain('Share on');
    expect(text).not.toContain('credits');
  });

  it('renders the "Share Badge on LinkedIn" claim button when claimable', () => {
    const fixture = render(
      makeBadge({ is_claimable: true, is_claimed: false, progress_percentage: 100 }),
    );
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Share Badge on');
    expect(text).not.toContain('Coming Soon');
    expect(text).not.toContain('credits');
  });

  it('renders the "Share on LinkedIn" CTA when claimed', () => {
    const fixture = render(
      makeBadge({ is_claimed: true, is_claimable: false, progress_percentage: 100 }),
    );
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Share on');
    expect(text).not.toContain('Share Badge on');
    expect(text).not.toContain('Coming Soon');
  });

  it('renders the locked progress bar with earned/required label when in-progress', () => {
    const fixture = render(
      makeBadge({
        is_claimable: false,
        is_claimed: false,
        is_coming_soon: false,
        earned_credits: 7.5,
        required_credits: 30,
        progress_percentage: 25,
      }),
    );
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('7.5');
    expect(text).toContain('30');
    expect(text).toContain('credits');
    expect(text).not.toContain('Coming Soon');
    expect(text).not.toContain('Share');
  });

  it('emits claim when the claimable CTA is clicked', () => {
    const fixture = render(makeBadge({ is_claimable: true, progress_percentage: 100 }));
    let emitted: BadgeItem | null = null;
    fixture.componentRef.instance.claim.subscribe((b) => (emitted = b));
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector('button');
    button?.click();
    expect(emitted).not.toBeNull();
    expect(emitted!.id).toBe(1);
  });

  it('emits share when the claimed CTA is clicked', () => {
    const fixture = render(
      makeBadge({ is_claimed: true, is_claimable: false, progress_percentage: 100 }),
    );
    let emitted: BadgeItem | null = null;
    fixture.componentRef.instance.share.subscribe((b) => (emitted = b));
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector('button');
    button?.click();
    expect(emitted).not.toBeNull();
    expect(emitted!.id).toBe(1);
  });

  it('splits "Name — Level" into name + level for display', () => {
    const fixture = render(makeBadge({ name: 'CAIRA — Level 1', level: 'Level 1' }));
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('CAIRA');
    expect(text).toContain('Level 1');
  });
});
