import { Component } from '@angular/core';

import { CpaCairaSection } from './shared/components/cpa-caira-section/cpa-caira-section';

/**
 * CPA marketing landing page.
 *
 * Rendered at `/<country>/accounting/home` for the country segments listed in
 * `cpaLandingMatchGuard` (currently `ae`). Every other country/profession keeps
 * the default `Home` page — the routing swap lives in `features.ts` via a
 * `CanMatch` guard, so both pages stay independently lazy-loaded.
 *
 * Phase 0 ships the page shell + the CAIRA section (carousel + Tracks). The
 * remaining full-parity sections (hero, jobs, testimonials, pan-India, app,
 * all-about, webinar, FAQ, sticky CTA) are added in later phases — see
 * CPA_LANDING_MIGRATION_PLAN.md §7/§8.
 */
@Component({
  selector: 'app-cpa-landing',
  imports: [CpaCairaSection],
  templateUrl: './cpa-landing.html',
  styleUrl: './cpa-landing.css',
})
export class CpaLanding {}
