import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { DialogRef } from '../../../core/services/dialog/dialog';
import { BadgeInfoDialog, BadgeInfoDialogResult } from './badge-info-dialog';

function makeBadge(overrides: Partial<any> = {}): any {
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

function setupFixture(badges: any[]) {
  const fixture = TestBed.createComponent(BadgeInfoDialog);
  const closes = new Subject<BadgeInfoDialogResult | undefined>();
  const close = vi.fn();
  fixture.componentInstance.dialogRef = {
    close: (result?: BadgeInfoDialogResult) => {
      close(result);
      closes.next(result);
    },
    afterClosed$: closes.asObservable(),
  } as unknown as DialogRef<BadgeInfoDialog, BadgeInfoDialogResult>;
  fixture.componentInstance.data = { badges };
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
    const closeBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[aria-label="Close badge dialog"]',
    );
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
