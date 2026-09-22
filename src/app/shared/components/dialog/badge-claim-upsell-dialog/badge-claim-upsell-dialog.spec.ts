import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { BadgeItem } from '@core/models/cpe-tracker.model';
import { DialogRef } from '@core/services/dialog/dialog';
import { BadgeClaimUpsellDialog, BadgeClaimUpsellDialogResult } from './badge-claim-upsell-dialog';

function makeBadge(): BadgeItem {
  return {
    id: 1,
    name: 'CAIRA — Level 1',
    sub_text: 'Foundations of AI in Accounting',
    description: 'Gain a solid foundation in AI for accounting workflows.',
    image_url: 'https://cdn/level1.webp',
    level: 'Level 1',
    level_rank: 1,
    required_credits: 30,
    earned_credits: 30,
    progress_percentage: 100,
    status: 'unlocked',
    is_claimed: false,
    is_claimable: true,
    is_coming_soon: false,
  };
}

function setupFixture() {
  const fixture = TestBed.createComponent(BadgeClaimUpsellDialog);
  const closes = new Subject<BadgeClaimUpsellDialogResult | undefined>();
  const close = vi.fn();
  fixture.componentInstance.dialogRef = {
    close: (result?: BadgeClaimUpsellDialogResult) => {
      close(result);
      closes.next(result);
    },
    afterClosed$: closes.asObservable(),
  } as unknown as DialogRef<BadgeClaimUpsellDialog, BadgeClaimUpsellDialogResult>;
  fixture.componentInstance.data = { badge: makeBadge() };
  fixture.detectChanges();
  return { fixture, close };
}

describe('BadgeClaimUpsellDialog', () => {
  it('renders the badge name (base, without level suffix) in the title', () => {
    const { fixture } = setupFixture();
    expect(fixture.nativeElement.textContent).toContain('CAIRA');
  });

  it('closes with action=confirm when Subscribe Now clicks', () => {
    const { fixture, close } = setupFixture();
    fixture.componentInstance['onConfirm']();
    expect(close).toHaveBeenCalledWith({ action: 'confirm', result: true });
  });

  it('closes with action=close when Not now clicks', () => {
    const { fixture, close } = setupFixture();
    fixture.componentInstance['onClose']();
    expect(close).toHaveBeenCalledWith({ action: 'close', result: false });
  });
});
