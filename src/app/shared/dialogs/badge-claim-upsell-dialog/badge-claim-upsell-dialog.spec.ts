import { TestBed } from '@angular/core/testing';
import { BadgeItem } from '@core/models/cpe-tracker.model';
import { NgpDialogRef } from 'ng-primitives/dialog';
import { stubDialogShell } from '@testing/mocks/dialog-ref.mock';
import { BadgeClaimUpsellDialog } from './badge-claim-upsell-dialog';

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
  const close = vi.fn();
  stubDialogShell(BadgeClaimUpsellDialog);
  TestBed.configureTestingModule({
    providers: [{ provide: NgpDialogRef, useValue: { close, data: { badge: makeBadge() } } }],
  });
  const fixture = TestBed.createComponent(BadgeClaimUpsellDialog);
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
