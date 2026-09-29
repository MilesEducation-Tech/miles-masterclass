import { Component, signal } from '@angular/core';
import { clearCachesAndReload } from '@core/version/cache-buster';

import { Dialog } from '@shared/ui/dialog/dialog';

/**
 * Non-closeable "a new version is available" dialog. Opened by UpdateChecker;
 * the shell is `[dismissible]="false"` (no backdrop/ESC dismissal, no close button), so
 * the only way forward is the Update action — which clears caches and reloads
 * onto the freshly deployed version.
 */
@Component({
  selector: 'app-version-update-dialog',
  imports: [Dialog],
  templateUrl: './version-update-dialog.html',
  host: { class: 'block' },
})
export class VersionUpdateDialog {
  readonly updating = signal(false);

  update(): void {
    if (this.updating()) return;
    this.updating.set(true);
    void clearCachesAndReload();
  }
}
