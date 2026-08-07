import { computed, Service, signal } from '@angular/core';

/**
 * Service to track global loading state across HTTP requests.
 * Used by the app interceptor to show/hide loading indicators.
 */
@Service()
export class LoadingService {
  /** Number of active HTTP requests */
  private readonly _activeRequests = signal(0);

  /** Whether any request is currently in progress */
  readonly isLoading = computed(() => this._activeRequests() > 0);

  /** Current number of active requests */
  readonly activeCount = this._activeRequests.asReadonly();

  /**
   * Increment active request count (called when request starts)
   */
  start(): void {
    this._activeRequests.update((count) => count + 1);
  }

  /**
   * Decrement active request count (called when request completes)
   */
  stop(): void {
    this._activeRequests.update((count) => Math.max(0, count - 1));
  }

  /**
   * Reset all active requests to zero
   */
  reset(): void {
    this._activeRequests.set(0);
  }
}
