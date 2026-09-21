import { EXCLUSIVE_ADMIN_ROLE_SLUGS } from '../../../../shared/core/models/admin/admin-rbac.model';
import { PartnerRole } from '../../../partner-platform/shared/models/partner-platform.model';

/** How a Supabase partner role maps onto the Django `PartnerAdmin` row. */
export interface PartnerMapping {
  role: PartnerRole;
  /**
   * 'either' — bind to a network OR a standalone firm (firm downgrades to role=firm);
   * 'firm'   — firms only (sub-company admin);
   * 'none'   — unscoped Django super (Miles ops).
   */
  scope: 'either' | 'firm' | 'none';
}

/**
 * Supabase slug → Django mapping. Keys MUST equal `EXCLUSIVE_ADMIN_ROLE_SLUGS`
 * (one Django row per login) — pinned by role-selection.spec.ts.
 */
export const PARTNER_ROLE_MAP: Record<string, PartnerMapping> = {
  super_admin: { role: 'super', scope: 'none' },
  partner_platform_admin: { role: 'super', scope: 'none' },
  partner_network_admin: { role: 'network', scope: 'either' },
  partner_subcompany_admin: { role: 'firm', scope: 'firm' },
};

/** The one Django-mapped role in a selection, or null. */
export function partnerRoleOf(
  slugs: Iterable<string>,
): { slug: string; mapping: PartnerMapping } | null {
  for (const slug of slugs) {
    const mapping = PARTNER_ROLE_MAP[slug];
    if (mapping) return { slug, mapping };
  }
  return null;
}

// ponytail: exported only so the spec can assert the two sets agree.
export const PARTNER_ROLE_SLUGS: ReadonlySet<string> = EXCLUSIVE_ADMIN_ROLE_SLUGS;
