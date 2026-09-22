import { NgOptimizedImage } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { NgpTabButton, NgpTabList, NgpTabPanel, NgpTabset } from 'ng-primitives/tabs';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { DialogRef } from '@core/services/dialog/dialog';
import {
  BadgeV2Response,
  CAIRA_STATUS_LABEL,
  CairaBadgeBullet,
  CairaBadgeContent,
  CairaLadderItem,
} from '@core/models/caira-badge.model';
import { SKIP_ERROR_NOTIFICATION } from '@core/models/http.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { Button } from '../../ui/button/button';
import { Spinner } from '../../ui/spinner/spinner';

export interface CairaBadgeInfoDialogData {
  /** The ladder row from the list response — supplies the header only. */
  level: CairaLadderItem;
}

export interface CairaBadgeInfoDialogResult {
  action: 'close';
}

const TABS = [
  { key: 'what_you_will_learn', label: 'What You Will Learn' },
  { key: 'how_will_you_learn', label: 'How Will You Learn' },
  { key: 'what_will_you_get', label: 'What Will You Get' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const EMPTY_DETAIL: BadgeV2Response<CairaLadderItem | null> = { data: null };

/**
 * The ⓘ modal on the CAIRA tracker hero.
 *
 * `v2/caira-badges/` omits `content` — it is retrieve-only — so the tab bodies
 * come from a `v2/caira-badges/:id/` call this dialog makes itself.
 *
 * That endpoint is keyed on the nested **badge** id (`badge.id`, e.g. `2`) but
 * responds with the user's *ladder row* for it, whose own `id` is unrelated
 * (e.g. `6264`) — so the content unwraps through `data.badge`, not `data`.
 *
 * The header (image, title, status) reads the ladder row that was passed in, so
 * the modal paints immediately and only the tabs wait on the network.
 */
@Component({
  selector: 'app-caira-badge-info-dialog',
  imports: [Button, NgOptimizedImage, Spinner, NgpTabset, NgpTabList, NgpTabButton, NgpTabPanel],
  templateUrl: './caira-badge-info-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CairaBadgeInfoDialog {
  private readonly api = inject(ApiClient);

  dialogRef!: DialogRef<CairaBadgeInfoDialog, CairaBadgeInfoDialogResult>;

  private readonly _data = signal<CairaBadgeInfoDialogData | null>(null);

  set data(value: CairaBadgeInfoDialogData) {
    this._data.set(value);
  }

  protected readonly tabs = TABS;
  protected readonly selectedTab = linkedSignal<TabKey>(() => TABS[0].key);

  protected readonly level = computed(() => this._data()?.level ?? null);

  /**
   * `undefined` params keep the resource idle until `Dialog.open` assigns
   * `data`. No SSR guard is needed — `Dialog.open` is a no-op on the server, so
   * this component never constructs there.
   *
   * Errors are silenced: the header has already rendered and the tabs fall back
   * to their empty copy, so a toast stacked over an open dialog adds nothing.
   */
  private readonly detailResource = resource({
    params: () => {
      const id = this._data()?.level.badge.id;
      return id ? { id } : undefined;
    },
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.api
          .get<BadgeV2Response<CairaLadderItem | null>>(`v2/caira-badges/${params.id}/`, {
            context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
          })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: EMPTY_DETAIL },
      ),
  });

  protected readonly isLoading = computed(() => this.detailResource.isLoading());

  /** `value()` throws on an errored resource — guard it and degrade to no content. */
  private readonly content = computed<CairaBadgeContent | null>(() =>
    this.detailResource.hasValue()
      ? (this.detailResource.value()?.data?.badge.content ?? null)
      : null,
  );

  protected readonly imageUrl = computed(() => {
    const l = this.level();
    return l?.image_url || l?.badge.icon_url || null;
  });

  /** "CAIRA Level 2" already reads as a name; only append an unused level name. */
  protected readonly title = computed(() => {
    const badge = this.level()?.badge;
    if (!badge) return '';
    const level = badge.level_name;
    return level && !badge.name.includes(level) ? `${badge.name} ${level}` : badge.name;
  });

  protected readonly statusLabel = computed(() => {
    const status = this.level()?.status;
    return status ? CAIRA_STATUS_LABEL[status] : '';
  });

  protected bulletsFor(key: TabKey): readonly CairaBadgeBullet[] {
    return this.content()?.[key] ?? [];
  }

  protected onClose(): void {
    this.dialogRef.close({ action: 'close' });
  }
}
