import { Component, inject } from '@angular/core';
import {
  AI_LABS_CALLBACK_DONE,
  AI_LABS_CHANNEL,
  AiLabsAuth,
} from '../../shared/core/services/ai-labs-auth/ai-labs-auth';

/**
 * OAuth landing page for the AI Labs sign-in popup. Never seen for more than a
 * moment: constructing the Supabase client parses the `?code=` off the URL and
 * writes the session, then this window announces itself and closes.
 *
 * It must close ITSELF. `window.opener` is null here — COOP severed the link
 * during the Microsoft hop — so the opener can neither observe nor close this
 * popup, and gating the close on `window.opener` (as this did) left it
 * orphaned. `window.close()` is honoured because the window was script-opened;
 * if this URL is opened directly in a normal tab the browser ignores the call
 * and the visitor just sees the message below.
 */
@Component({
  selector: 'app-ai-labs-callback',
  template: `
    <div class="flex min-h-screen items-center justify-center bg-background px-4">
      <p class="text-sm text-muted-foreground" role="status">Completing sign-in…</p>
    </div>
  `,
})
export class AiLabsCallback {
  private readonly auth = inject(AiLabsAuth);

  constructor() {
    // `restoreSession` builds the client, which is what triggers Supabase's
    // code-for-session exchange against this URL.
    void this.auth.restoreSession().then(() => {
      if (typeof window === 'undefined') return;
      // Announce unconditionally — the opener re-reads the session itself, so a
      // callback that arrived without one still releases it instead of leaving
      // it spinning until the timeout.
      const channel = new BroadcastChannel(AI_LABS_CHANNEL);
      channel.postMessage(AI_LABS_CALLBACK_DONE);
      channel.close();
      window.close();
    });
  }
}
