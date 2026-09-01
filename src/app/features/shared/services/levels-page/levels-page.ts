import { httpResource } from '@angular/common/http';
import { Service, computed, inject } from '@angular/core';
import { ApiClient } from '../../../../shared/core/services/api-client/api-client';
import { CAIRA } from '../../../../shared/core/http/caira.endpoints';
import { cairaError } from '../../../../shared/core/http/caira-error';
import {
  FAQ_SECTION_TYPE,
  FaqEntry,
  LevelTab,
  LevelsPageFilteredResponse,
  LevelsPageResponse,
  toFaqEntries,
  toLevelTabs,
  toLevelsPageTitle,
} from '../../../../shared/core/models/caira/levels-page.model';

/**
 * L1 · `caira/masterclass/levels-page/` — the CAIRA level tabs and the FAQ.
 *
 * **App-wide singleton, like `FeatureFacade`.** The content is static and
 * user-independent, so one instance means the tabs survive navigation between
 * the listing and a course instead of refetching on every return.
 *
 * **Two resources on one path, not one read plus a client-side filter.** The
 * `?type=` call returns a different response shape (a flat section array), and
 * the server owns what counts as a section — deriving the FAQ from the bare
 * tree would re-implement that decision in the browser and drift from it.
 *
 * The reads are **not** gated on `Auth`. The shipped LMS always calls them with
 * a token, but whether the endpoint requires one is unconfirmed, and a request
 * that never fires is not diagnosable: let it run, let `errorInterceptor`
 * classify a 403 as `kind: 'auth'` without toasting, and render the empty state.
 * That also keeps the masterclass listing server-renderable.
 */
@Service()
export class LevelsPage {
  private readonly api = inject(ApiClient);

  private readonly tree = httpResource<LevelsPageResponse | undefined>(
    () => this.api.absoluteUrl(CAIRA.levelsPage),
    { defaultValue: undefined },
  );

  private readonly faqTree = httpResource<LevelsPageFilteredResponse | undefined>(
    () => `${this.api.absoluteUrl(CAIRA.levelsPage)}?type=${encodeURIComponent(FAQ_SECTION_TYPE)}`,
    { defaultValue: undefined },
  );

  readonly isLoading = this.tree.isLoading;
  readonly isLoadingFaq = this.faqTree.isLoading;

  readonly error = computed(() => {
    const err = this.tree.error();
    return err ? cairaError(err) : null;
  });

  /**
   * `error()` before `value()` in every computed below — `value()` throws
   * `ResourceValueError` once the resource has failed, which would turn one bad
   * request into a render failure in every consumer.
   */
  readonly tabs = computed<LevelTab[]>(() =>
    this.tree.error() ? [] : toLevelTabs(this.tree.value()),
  );

  /** `null` when the server has nothing — the page keeps its own heading. */
  readonly title = computed<string | null>(() =>
    this.tree.error() ? null : toLevelsPageTitle(this.tree.value()),
  );

  readonly faqs = computed<FaqEntry[]>(() =>
    this.faqTree.error() ? [] : toFaqEntries(this.faqTree.value()),
  );

  readonly hasContent = computed(() => this.tabs().length > 0);

  reload(): void {
    this.tree.reload();
    this.faqTree.reload();
  }
}
