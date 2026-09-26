import { Component, signal } from '@angular/core';
import { clearCachesAndReload } from '@core/version/cache-buster';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';

/**
 * Non-closeable "a new version is available" dialog. Opened by UpdateChecker;
 * the shell is `[dismissible]="false"` (no backdrop/ESC dismissal, no close button), so
 * the only way forward is the Update action — which clears caches and reloads
 * onto the freshly deployed version.
 */
@Component({
  selector: 'app-version-update-dialog',
  imports: [DialogShell],
  templateUrl: './version-update-dialog.html',
  styleUrl: './version-update-dialog.css',
})
export class VersionUpdateDialog {
  readonly updating = signal(false);

  update(): void {
    if (this.updating()) return;
    this.updating.set(true);
    void clearCachesAndReload();
  }
}
