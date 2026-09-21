import { describe, expect, it } from 'vitest';

import { toggleRoleSlug } from '../../../../shared/core/models/admin/admin-rbac.model';
import { PARTNER_ROLE_MAP, PARTNER_ROLE_SLUGS, partnerRoleOf } from './role-selection';

/**
 * The invariant worth pinning: Django keeps ONE PartnerAdmin row per login, so
 * the partner roles must behave like radios while every other role stacks. If
 * the two slug sets ever drift, provisioning silently posts the wrong Django
 * role — the backend's `assert_admin_role_set()` is the last line of defence.
 */
describe('role selection', () => {
  it('keeps PARTNER_ROLE_MAP in sync with the exclusive slug set', () => {
    expect(new Set(Object.keys(PARTNER_ROLE_MAP))).toEqual(new Set(PARTNER_ROLE_SLUGS));
  });

  it('stacks internal roles', () => {
    let set = toggleRoleSlug(new Set(), 'seo_manager', true);
    set = toggleRoleSlug(set, 'leads_manager', true);
    expect([...set]).toEqual(['seo_manager', 'leads_manager']);
  });

  it('treats partner roles as radios and leaves internal roles alone', () => {
    let set = toggleRoleSlug(new Set(['seo_manager']), 'partner_network_admin', true);
    set = toggleRoleSlug(set, 'partner_subcompany_admin', true);
    expect([...set]).toEqual(['seo_manager', 'partner_subcompany_admin']);
    expect(partnerRoleOf(set)?.mapping.role).toBe('firm');
  });

  it('unticking removes without touching the rest', () => {
    const set = toggleRoleSlug(new Set(['seo_manager', 'admin_manager']), 'seo_manager', false);
    expect([...set]).toEqual(['admin_manager']);
    expect(partnerRoleOf(set)).toBeNull();
  });
});
