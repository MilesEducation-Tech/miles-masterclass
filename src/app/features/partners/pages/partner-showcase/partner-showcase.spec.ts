import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PartnerShowcase } from './partner-showcase';
import { CORPORATE } from '../../data/corporate';
import { ILLINOIS } from '../../data/illinois';
import type { PartnerShowcaseConfig } from '../../models/partner-showcase.model';

describe('PartnerShowcase', () => {
  let fixture: ComponentFixture<PartnerShowcase>;

  async function render(partner: PartnerShowcaseConfig): Promise<HTMLElement> {
    fixture.componentRef.setInput('partner', partner);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartnerShowcase],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PartnerShowcase);
  });

  it('opens on the compliance block with its own CTAs, and offers the strategy call', async () => {
    const el = await render(CORPORATE);

    expect(el.textContent).toContain('Book Demo');
    expect(el.textContent).not.toContain('Explore Courses');
    expect(el.textContent).toContain('Book a Strategy Call');
    expect(el.querySelector('#corporate-content-section')?.classList).not.toContain('mb-32');
    expect(el.querySelector('app-plan-benefits')).toBeNull();
  });

  it('renders the hero, the benefits offer and no strategy call for Illinois', async () => {
    const el = await render(ILLINOIS);

    expect(el.textContent).toContain('Explore Courses');
    expect(el.textContent).not.toContain('Book Demo');
    expect(el.querySelector('app-plan-benefits strong')?.textContent).toContain(
      '$1,000 off the Annual Subscription.',
    );
    expect(el.textContent).toContain('This is career infrastructure');
    expect(el.textContent).not.toContain('Book a Strategy Call');
    expect(el.querySelector('#illinois-section')?.classList).toContain('mb-32');
  });
});
