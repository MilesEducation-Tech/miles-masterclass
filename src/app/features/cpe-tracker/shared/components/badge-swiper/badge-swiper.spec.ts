import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgeSwiper } from './badge-swiper';

function makeBadge(overrides: Partial<any> = {}): any {
  return {
    id: 1,
    name: 'CAIRA — Level 1',
    sub_text: 'Foundations',
    description: 'desc',
    image_url: 'https://cdn/badge.png',
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

describe('BadgeSwiper', () => {
  let component: BadgeSwiper;
  let fixture: ComponentFixture<BadgeSwiper>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeSwiper],
    }).compileComponents();

    fixture = TestBed.createComponent(BadgeSwiper);
    fixture.componentRef.setInput('badges', []);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the empty state when no badges are supplied', () => {
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No badges yet');
  });

  it('renders the "View all" pill when there are badges', () => {
    fixture.componentRef.setInput('badges', [makeBadge()]);
    fixture.detectChanges();
    const pill: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      '[aria-label="View all badges"]',
    );
    expect(pill).not.toBeNull();
  });

  it('does NOT render the "View all" pill when there are no badges', () => {
    fixture.detectChanges();
    const pill = fixture.nativeElement.querySelector('[aria-label="View all badges"]');
    expect(pill).toBeNull();
  });

  it('emits openInfo when the "View all" pill is clicked', () => {
    fixture.componentRef.setInput('badges', [makeBadge()]);
    let opened = false;
    fixture.componentInstance.openInfo.subscribe(() => (opened = true));
    fixture.detectChanges();
    const pill: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[aria-label="View all badges"]',
    );
    pill.click();
    expect(opened).toBe(true);
  });
});
