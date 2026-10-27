import { HttpContext, HttpErrorResponse, httpResource } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  PLATFORM_ID,
  Service,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { filter, fromEvent } from 'rxjs';
import { CommonResponse, SKIP_ERROR_NOTIFICATION, SKIP_LOADING } from '@core/models/http.model';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { NotificationService } from '@core/services/notification/notification';
import { AI_LABS_API } from '@features/ai-labs/constants/ai-labs-api';
import { AiLabTokenBalance, AiLabTokenRequestBody } from '@features/ai-labs/models/ai-labs.model';
import type { AiLabTokenRequestData } from '@features/ai-labs/dialogs/ai-lab-token-request-dialog/ai-lab-token-request-dialog';

/** `data` of `tokens/`. */
interface TokensBody {
  is_provisioned: boolean;
  tokens: AiLabTokenBalance | null;
}

/**
 * The learner's Copilot Credits: the balance and the top-up request. The landing page and the lab
 * page both show the meter, so this is its own small service rather than a part of either facade —
 * one balance read, one dialog → POST → toast path, not two that drift apart.
 *
 * Route-scoped (`autoProvided: false`, on both AI Labs routes). `tokens/` calls AI Labs, so the
 * read is quiet: `is_provisioned: false` (no AI Labs account) and any failure both render as no
 * meter rather than an error. The balance is re-read when the tab comes back into view, since
 * credits are spent in Copilot Studio, in another tab.
 */
@Service({ autoProvided: false })
export class AiLabCredits {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthSession);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly tokensRes = httpResource<TokensBody | null>(
    () =>
      this.isBrowser && this.auth.isAuthenticated()
        ? {
            url: apiUrl(AI_LABS_API.tokens),
            context: new HttpContext().set(SKIP_LOADING, true).set(SKIP_ERROR_NOTIFICATION, true),
          }
        : undefined,
    {
      defaultValue: null,
      parse: (raw) => (raw as CommonResponse<TokensBody> | null)?.data ?? null,
    },
  );

  /** `null` for no allotment — unprovisioned, failed, or not read yet. Both meters hide on it. */
  readonly balance = computed<AiLabTokenBalance | null>(() => {
    const body = this.tokensRes.hasValue() ? this.tokensRes.value() : null;
    return body?.is_provisioned ? (body.tokens ?? null) : null;
  });

  readonly isLoading = computed(() => this.tokensRes.isLoading());

  /** A top-up request is in flight. */
  readonly submitting = signal(false);

  constructor() {
    if (this.isBrowser) {
      fromEvent(this.document, 'visibilitychange')
        .pipe(
          filter(() => this.document.visibilityState === 'visible' && !!this.balance()),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => this.tokensRes.reload());
    }
  }

  /** Re-read the balance — once the lab account is built, the landing's wait ends with a meter. */
  reload(): void {
    this.tokensRes.reload();
  }

  /**
   * Open the top-up dialog and, if the learner picks an add-on, raise the request. The dialog
   * loads on demand, in its own chunk. The meter never offers this while a request is pending, so
   * a 409 here is a race, said the way the server says it.
   */
  async requestTopUp(): Promise<void> {
    const balance = this.balance();
    if (!balance || this.submitting()) return;

    const { AiLabTokenRequestDialog } =
      await import('@features/ai-labs/dialogs/ai-lab-token-request-dialog/ai-lab-token-request-dialog');
    this.dialogs
      .open<AiLabTokenRequestData, AiLabTokenRequestBody>(AiLabTokenRequestDialog, {
        data: { remaining: balance.remaining, cap: balance.cap },
      })
      .afterClosed.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((body) => {
        if (body) this.submit(body);
      });
  }

  /** `POST tokens-request/`, then re-read the balance so the pending request shows. */
  private submit(body: AiLabTokenRequestBody): void {
    this.submitting.set(true);
    this.api
      .call(AI_LABS_API.tokensRequest, body, {
        context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.notification.success('Request sent', res.message);
          this.tokensRes.reload();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          const env =
            err instanceof HttpErrorResponse ? (err.error as CommonResponse<unknown>) : null;
          if (err instanceof HttpErrorResponse && err.status === 409) {
            this.notification.info(
              'Request already open',
              env?.message ?? 'You already have a credits request open.',
            );
          } else {
            this.notification.error(
              "Couldn't send the request",
              env?.message || 'Please try again shortly.',
            );
          }
          this.tokensRes.reload();
        },
      });
  }
}
