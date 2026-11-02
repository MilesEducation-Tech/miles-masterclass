import { isPlatformBrowser } from '@angular/common';
import { Component, DOCUMENT, PLATFORM_ID, inject } from '@angular/core';
import {
  AI_LAB_CALLBACK_DONE,
  AI_LAB_CHANNEL,
  AiLabAuth,
} from '@core/services/ai-lab-auth/ai-lab-auth';

/**
 * `error_description` as Supabase returns it — in the query string for the PKCE flow, in the
 * fragment for the implicit one. Null when the callback carries a code rather than a failure.
 */
function describeOAuthError(loc: Location): string | null {
  const params = new URLSearchParams(loc.search);
  const hash = new URLSearchParams(loc.hash.replace(/^#/, ''));
  const description = params.get('error_description') ?? hash.get('error_description');
  const code = params.get('error') ?? hash.get('error');
  return description ?? code ?? null;
}

/**
 * OAuth landing page for the AI Labs sign-in popup — upstream's `AiLabCallback`, ported. Never seen
 * for more than a moment: constructing the labs Supabase client parses the `?code=` off the URL and
 * writes the session, then this window announces itself and closes.
 *
 * It must close ITSELF. `window.opener` is null here — COOP severed the link during the Microsoft
 * hop — so the opener can neither observe nor close this popup. `window.close()` is honoured because
 * the window was script-opened; if this URL is opened directly in a normal tab the browser ignores
 * the call and the visitor just sees the message below.
 */
@Component({
  selector: 'app-ai-lab-callback',
  template: `
    <div class="flex min-h-screen items-center justify-center bg-background px-4">
      <p class="text-sm text-muted-foreground" role="status">Completing sign-in…</p>
    </div>
  `,
})
export class AiLabCallback {
  private readonly auth = inject(AiLabAuth);
  private readonly document = inject(DOCUMENT);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    // `restoreSession` builds the client, which is what triggers Supabase's code-for-session
    // exchange against this URL.
    void this.auth.restoreSession().then(() => {
      const win = this.document.defaultView;
      if (!win) return;
      // Announce unconditionally — the opener re-reads the session itself, so a callback that
      // arrived without one still releases it instead of leaving it spinning until the timeout. A
      // provider-side failure rides along: Supabase redirects here with `error_description` and no
      // session, and this window dies too fast to show it, so the opener renders it.
      const channel = new BroadcastChannel(AI_LAB_CHANNEL);
      const reason = describeOAuthError(win.location);
      channel.postMessage(reason ? `${AI_LAB_CALLBACK_DONE}:${reason}` : AI_LAB_CALLBACK_DONE);
      channel.close();
      win.close();
    });
  }
}
