import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BadgeItem } from '../../../../../shared/core/models/cpe-tracker.model';
import { Dialog } from '../../../../../shared/core/services/dialog/dialog';
import { BadgeClaimUpsellDialog } from '../../../../../shared/components/dialog/badge-claim-upsell-dialog/badge-claim-upsell-dialog';
import { BadgeInfoDialog } from '../../../../../shared/components/dialog/badge-info-dialog/badge-info-dialog';
import { TrackerDialogOrchestrator } from './tracker-dialog-orchestrator';

function makeBadge(overrides: Partial<BadgeItem> = {}): BadgeItem {
  return {
    id: 1,
    name: 'CAIRA — Level 1',
    sub_text: 'Foundations',
    description: 'desc',
    image_url: 'https://cdn/badge.png',
    level: 'Level 1',
    level_rank: 1,
    required_credits: 30,
    earned_credits: 30,
    progress_percentage: 100,
    status: 'unlocked',
    is_claimed: false,
    is_claimable: true,
    is_coming_soon: false,
    ...overrides,
  };
}

describe('TrackerDialogOrchestrator', () => {
  let service: TrackerDialogOrchestrator;
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openSpy = vi.fn().mockReturnValue({ afterClosed$: of(undefined) });
    TestBed.configureTestingModule({
      providers: [{ provide: Dialog, useValue: { open: openSpy } }],
    });
    service = TestBed.inject(TrackerDialogOrchestrator);
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  it('openClaimUpsell opens BadgeClaimUpsellDialog with the badge in data', () => {
    const badge = makeBadge();
    service.openClaimUpsell(badge);
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [component, config] = openSpy.mock.calls[0];
    expect(component).toBe(BadgeClaimUpsellDialog);
    expect(config.data).toEqual({ badge });
  });

  it('openBadgeInfo opens BadgeInfoDialog with the badge list in data', () => {
    const badges = [makeBadge({ id: 1 }), makeBadge({ id: 2 })];
    service.openBadgeInfo(badges);
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [component, config] = openSpy.mock.calls[0];
    expect(component).toBe(BadgeInfoDialog);
    expect(config.data).toEqual({ badges });
  });
});
