import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PartnerLanding } from './partner-landing';
import { CTCPA } from '../../data/ctcpa';
import type { PartnerLandingConfig } from '../../models/partner-landing.model';

describe('PartnerLanding', () => {
  let fixture: ComponentFixture<PartnerLanding>;

  async function render(partner: PartnerLandingConfig): Promise<HTMLElement> {
    fixture.componentRef.setInput('partner', partner);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartnerLanding],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PartnerLanding);
  });

  it("renders a society partner's pill, anchors and offer copy", async () => {
    const el = await render(CTCPA);

    expect(el.textContent).toContain('CTCPA Members Access');
    expect(el.querySelector('#connecticut-content-section')).not.toBeNull();
    expect(el.querySelector('#connecticut-section')).not.toBeNull();
    expect(el.querySelector('p strong')?.textContent).toContain('$599 (Save $400)');
    expect(el.textContent).toContain('Schedule Discovery Call');
    expect(el.textContent).toContain(
      'Exclusive Benefits for Members of the Connecticut Society of CPAs',
    );
  });

  it('renders the firm copy and CTA, a highlighted heading and the short <h3> offer', async () => {
    const el = await render({
      ...CTCPA,
      audience: 'firm',
      pill: { brand: 'HSCPA', brandClass: 'text-[#f9bb16]' },
      benefits: {
        heading: 'Exclusive Benefits for Members of the',
        highlight: { text: 'Hawaii Society of CPAs', class: 'text-[#f9bb16]' },
      },
    });

    expect(el.textContent).toContain("Activate Your Firm's Access");
    expect(el.textContent).toContain("It's how your firm stays competitive");
    expect(el.querySelector('span.text-\\[\\#f9bb16\\]')?.textContent).toBe('HSCPA');
    expect(el.textContent).toContain('Hawaii Society of CPAs');

    const short = await render({ ...CTCPA, shortOffer: true });
    expect(short.querySelector('app-plan-benefits h3')?.textContent).toContain(
      'This is how you stay relevant',
    );
    expect(short.textContent).not.toContain('$599');
  });
});
