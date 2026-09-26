import { TestBed } from '@angular/core/testing';
import { BadgeItem } from '@core/models/cpe-tracker.model';
import { NgpDialogRef } from 'ng-primitives/dialog';
import { stubDialogShell } from '@testing/mocks/dialog-ref.mock';
import { BadgeInfoDialog } from './badge-info-dialog';

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
    earned_credits: 7.5,
    progress_percentage: 25,
    status: 'unlocked',
    is_claimed: false,
    is_claimable: false,
    is_coming_soon: false,
    ...overrides,
  };
}

function setupFixture(badges: BadgeItem[]) {
  const close = vi.fn();
  stubDialogShell(BadgeInfoDialog);
  TestBed.configureTestingModule({
    providers: [{ provide: NgpDialogRef, useValue: { close, data: { badges } } }],
  });
  const fixture = TestBed.createComponent(BadgeInfoDialog);
  fixture.detectChanges();
  return { fixture, close };
}

describe('BadgeInfoDialog', () => {
  it('renders one card per badge', () => {
    const { fixture } = setupFixture([
      makeBadge({ id: 1 }),
      makeBadge({ id: 2, name: 'Auditor — Level 2', level_rank: 2 }),
    ]);
    const cards = fixture.nativeElement.querySelectorAll('app-badge-hero-card');
    expect(cards.length).toBe(2);
  });

  it('renders an empty state when there are no badges', () => {
    const { fixture } = setupFixture([]);
    expect(fixture.nativeElement.textContent).toContain('No badges yet');
  });

  it('closes with action=close when the close button is clicked', () => {
    const { fixture, close } = setupFixture([makeBadge()]);
    // The dialog now renders the shared `<app-button variant="close">`, whose
    // accessible name is hard-coded to 'Close' — the old
    // `aria-label="Close badge dialog"` no longer exists anywhere.
    const closeBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Close"]');
    closeBtn.click();
    expect(close).toHaveBeenCalledWith({ action: 'close', result: false });
  });

  it('closes with action=claim and the badge payload when a child claim fires', () => {
    const badge = makeBadge({ is_claimable: true, progress_percentage: 100, earned_credits: 30 });
    const { fixture, close } = setupFixture([badge]);
    fixture.componentInstance['onClaim'](badge);
    expect(close).toHaveBeenCalledWith({ action: 'claim', result: true, data: badge });
  });

  it('closes with action=share when a claimed badge fires share', () => {
    const badge = makeBadge({ is_claimed: true, progress_percentage: 100, earned_credits: 30 });
    const { fixture, close } = setupFixture([badge]);
    fixture.componentInstance['onShare'](badge);
    expect(close).toHaveBeenCalledWith({ action: 'share', result: true, data: badge });
  });
});
