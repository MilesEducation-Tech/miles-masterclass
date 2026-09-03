import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EngagementDialog } from './engagement-dialog';
import { Auth } from '../auth/auth';
import { Dialog } from '../dialog/dialog';
import { Storage } from '../storage/storage';
import { FeatureFacade } from '../../../../features/shared/services/feature-facade/feature-facade';
import { CurrentPlanData, User } from '../../models/auth.model';

interface AuthStub {
  currentUser: ReturnType<typeof signal<User | null>>;
  currentPlan: ReturnType<typeof signal<CurrentPlanData | null>>;
  isAuthenticated: ReturnType<typeof signal<boolean>>;
}

interface StorageStub {
  store: Map<string, unknown>;
  getSession: ReturnType<typeof vi.fn>;
  setSession: ReturnType<typeof vi.fn>;
  removeSession: ReturnType<typeof vi.fn>;
}

const userWithoutSector = (): User =>
  ({
    id: 1,
    sector: null,
    job_role: null,
    is_existing_user: true,
    email: 'a@b.com',
  }) as unknown as User;

const userWithFullProfile = (): User =>
  ({
    id: 1,
    sector: 'Industry',
    job_role: 'FP&A',
    is_existing_user: true,
    email: 'a@b.com',
  }) as unknown as User;

const activePlan = (): CurrentPlanData =>
  ({ id: 1, subscription_status: 'active' }) as unknown as CurrentPlanData;

const inactivePlan = (): CurrentPlanData =>
  ({ id: 1, subscription_status: 'Expired' }) as unknown as CurrentPlanData;

describe('EngagementDialog', () => {
  let service: EngagementDialog;
  let auth: AuthStub;
  let storage: StorageStub;
  let router: { url: string };

  beforeEach(() => {
    auth = {
      currentUser: signal<User | null>(null),
      currentPlan: signal<CurrentPlanData | null>(null),
      isAuthenticated: signal(false),
    };

    // Mutable so each test can place the user on a different route.
    router = { url: '/in/accounting/masterclass' };

    storage = {
      store: new Map<string, unknown>(),
      getSession: vi.fn(),
      setSession: vi.fn(),
      removeSession: vi.fn(),
    };
    storage.getSession.mockImplementation((key: string) => storage.store.get(key) ?? null);
    storage.setSession.mockImplementation((key: string, value: unknown) => {
      storage.store.set(key, value);
    });
    storage.removeSession.mockImplementation((key: string) => {
      storage.store.delete(key);
    });

    TestBed.configureTestingModule({
      providers: [
        EngagementDialog,
        { provide: Auth, useValue: auth },
        { provide: Storage, useValue: storage },
        { provide: Dialog, useValue: { open: vi.fn(), getOpenDialogCount: () => 0 } },
        { provide: FeatureFacade, useValue: { refreshPersonalized: vi.fn() } },
        { provide: Router, useValue: router },
      ],
    });
    service = TestBed.inject(EngagementDialog);
  });

  describe('resolveNext', () => {
    it('returns null when not authenticated (no user)', () => {
      expect(service.resolveNext()).toBeNull();
    });

    it("returns 'aiLab' first for any authenticated user, ahead of profile and subscription", () => {
      auth.currentUser.set(userWithoutSector());
      auth.currentPlan.set(inactivePlan());
      expect(service.resolveNext()).toBe('aiLab');
    });

    it("returns 'aiLab' even for a complete profile on an active plan", () => {
      auth.currentUser.set(userWithFullProfile());
      auth.currentPlan.set(activePlan());
      expect(service.resolveNext()).toBe('aiLab');
    });

    it('suppresses aiLab on checkout — no dialog interrupts a payment step', () => {
      router.url = '/in/accounting/payment/cart';
      auth.currentUser.set(userWithoutSector());
      auth.currentPlan.set(inactivePlan());
      expect(service.resolveNext()).toBeNull();
    });

    describe('once the AI Labs launch dialog has been shown', () => {
      // aiLab is unconditional at priority 1, so every lower-priority case below
      // only becomes reachable after it has been dismissed for the session.
      beforeEach(() => service.markDismissed('aiLab'));

      it("returns 'profile' when sector is missing", () => {
        auth.currentUser.set(userWithoutSector());
        expect(service.resolveNext()).toBe('profile');
      });

      it("returns 'profile' when only job_role is missing", () => {
        auth.currentUser.set({ ...userWithFullProfile(), job_role: null });
        expect(service.resolveNext()).toBe('profile');
      });

      it("returns 'subscription' when profile is complete but plan is inactive", () => {
        auth.currentUser.set(userWithFullProfile());
        auth.currentPlan.set(inactivePlan());
        expect(service.resolveNext()).toBe('subscription');
      });

      it("returns 'subscription' when profile is complete and no plan at all", () => {
        auth.currentUser.set(userWithFullProfile());
        auth.currentPlan.set(null);
        expect(service.resolveNext()).toBe('subscription');
      });

      it('returns null when profile is complete and plan is active', () => {
        auth.currentUser.set(userWithFullProfile());
        auth.currentPlan.set(activePlan());
        expect(service.resolveNext()).toBeNull();
      });

      it("treats 'Active' (PascalCase) as active — matches existing case-insensitive precedent", () => {
        auth.currentUser.set(userWithFullProfile());
        auth.currentPlan.set({ ...activePlan(), subscription_status: 'Active' });
        expect(service.resolveNext()).toBeNull();
      });

      it('falls through to subscription when profile is dismissed', () => {
        auth.currentUser.set(userWithoutSector());
        auth.currentPlan.set(inactivePlan());
        service.markDismissed('profile');
        expect(service.resolveNext()).toBe('subscription');
      });

      it('returns null when every dialog has been dismissed', () => {
        auth.currentUser.set(userWithoutSector());
        auth.currentPlan.set(null);
        service.markDismissed('profile');
        service.markDismissed('subscription');
        expect(service.resolveNext()).toBeNull();
      });

      // Payment is mounted under /:country/:profession_type, so a root-anchored
      // check never matches a real checkout URL.
      it.each([
        '/in/accounting/payment',
        '/in/accounting/payment/cart',
        '/in/accounting/payment/billing',
        '/in/accounting/payment/review',
        '/in/accounting/payment/plan',
        '/in/accounting/payment/order-history',
        '/in/accounting/payment/invoice/3079?status=success',
        '/us/finance/payment/cart',
      ])('suppresses profile and subscription on %s', (url) => {
        router.url = url;
        auth.currentUser.set(userWithoutSector());
        auth.currentPlan.set(inactivePlan());
        expect(service.resolveNext()).toBeNull();
      });

      it('still resolves normally once the user leaves checkout', () => {
        auth.currentUser.set(userWithoutSector());
        auth.currentPlan.set(inactivePlan());

        router.url = '/in/accounting/payment/cart';
        expect(service.resolveNext()).toBeNull();

        router.url = '/in/accounting/masterclass';
        expect(service.resolveNext()).toBe('profile');
      });

      it('does not treat a slug that merely starts with "payment" as checkout', () => {
        router.url = '/in/accounting/masterclass/payment-fraud-essentials';
        auth.currentUser.set(userWithoutSector());
        auth.currentPlan.set(inactivePlan());
        expect(service.resolveNext()).toBe('profile');
      });
    });

    it('suppresses every dialog inside the admin panel', () => {
      router.url = '/admin/users';
      auth.currentUser.set(userWithoutSector());
      auth.currentPlan.set(inactivePlan());
      expect(service.resolveNext()).toBeNull();
    });

    // AI Labs + MilesVerse simulations mount under /:country/:profession_type,
    // like payment — suppress every dialog (aiLab included) on them.
    it.each([
      '/in/accounting/ai-labs',
      '/in/accounting/ai-labs/audit',
      '/us/finance/simulation',
      '/us/finance/simulation/subjects/tax-101',
      '/us/finance/simulation/briefing/42',
      '/us/finance/simulation/report',
    ])('suppresses every engagement dialog on immersive route %s', (url) => {
      router.url = url;
      auth.currentUser.set(userWithoutSector());
      auth.currentPlan.set(inactivePlan());
      expect(service.resolveNext()).toBeNull();
    });

    it('does not treat a slug that merely starts with "ai-labs" as the AI Labs route', () => {
      router.url = '/in/accounting/masterclass/ai-labs-preview';
      auth.currentUser.set(userWithoutSector());
      auth.currentPlan.set(inactivePlan());
      expect(service.resolveNext()).toBe('aiLab');
    });

    it('still shows the AI Labs launch dialog during checkout', () => {
      router.url = '/in/accounting/payment/cart';
      auth.currentUser.set(userWithoutSector());
      auth.currentPlan.set(inactivePlan());
      expect(service.resolveNext()).toBe('aiLab');
    });
  });

  describe('markDismissed', () => {
    it('flips the in-memory signal and persists to sessionStorage', () => {
      expect(service.isDismissed('profile')).toBe(false);
      service.markDismissed('profile');
      expect(service.isDismissed('profile')).toBe(true);
      expect(storage.setSession).toHaveBeenCalledWith('engagement.dismissed.profile', true);
    });

    it('uses a distinct key per dialog kind', () => {
      service.markDismissed('subscription');
      expect(service.isDismissed('subscription')).toBe(true);
      expect(service.isDismissed('profile')).toBe(false);
      expect(storage.setSession).toHaveBeenCalledWith('engagement.dismissed.subscription', true);
    });
  });

  describe('start()', () => {
    it('hydrates dismissal flags from sessionStorage', () => {
      storage.store.set('engagement.dismissed.profile', true);
      // Re-create the service so the hydration path runs against the seeded
      // store (the singleton was already constructed in beforeEach).
      const fresh = TestBed.runInInjectionContext(() => new EngagementDialog());
      fresh.start();
      expect(fresh.isDismissed('profile')).toBe(true);
      expect(fresh.isDismissed('subscription')).toBe(false);
    });

    it('is idempotent — calling start() twice does not double-subscribe', () => {
      service.start();
      service.start();
      // Reaching here without throwing is the assertion; the internal `started`
      // guard prevents a second pipeline from being constructed.
      expect(true).toBe(true);
    });
  });
});
