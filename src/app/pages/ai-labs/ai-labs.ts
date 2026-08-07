import { Component, inject } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { Button } from '../../shared/components/ui/button/button';
import { AiLabsAuth } from '../../shared/core/services/ai-labs-auth/ai-labs-auth';
import { AI_LAB_SECTIONS } from './ai-labs.model';
import { NgOptimizedImage } from '@angular/common';
import { environment } from '../../../environments/environment';
import { iconCopilot, iconSparkle } from '../../shared/core/constant/icon';

/**
 * AI Labs landing page — dark editorial marketing page fronting the prebuilt
 * agent catalogue.
 *
 * Built entirely from project primitives (`app-button`, `ng-icon`, Tailwind
 * utilities over the site tokens) — the page declares no colour of its own, so
 * it moves with the palette instead of pinning a second one beside it. How the
 * source design's raw values were mapped:
 *
 *   - **#000000 canvas** → `--background`. The site canvas is rgb(14,14,14);
 *     forcing pure black would make this the only page that disagrees with the
 *     header and footer sitting above and below it.
 *   - **#3399ff accent** → `--accent` (rgb 42,133,255), the blue the rest of
 *     the site already uses for CTAs, 2 points off the source. The hero button
 *     is `variant="primary"` re-pointed with `bg-accent`, which is the project's
 *     own idiom; `--primary` is the deep navy and reads wrong here.
 *   - **#0c0f14 card surface** → `--muted`, the project's most-used card
 *     surface. It sits one step *above* `--background`, exactly the relationship
 *     the source pair has.
 *   - **#1f242c hairline** → `--border`. **#acb5c4 / #a1a1a1 body copy** →
 *     `--muted-foreground`.
 *   - **Hover #1a8cff** → `hover:bg-accent/90`, the DS opacity-shift convention,
 *     rather than a second blue.
 *   - **15px / 8–10px radii** → `rounded-2xl` and `rounded-xl` (`--radius-xl` is
 *     exactly 10px).
 *   - **Metal gradient text** — the one treatment with no DS equivalent, so
 *     `--ai-metal` / `.ai-metal-text` is a scoped extension. Its stops are the
 *     DS foreground ramp (`--muted-foreground` → `--foreground`), not new hexes.
 *     25° for section headings, horizontal for card titles, solid
 *     `--foreground` fallback.
 *   - **Serif display face** — the DS *does* have one (`--font-serif`,
 *     Source Serif 4), so `font-serif` is used rather than pulling in Playfair.
 *     Only the hero H1 is serif: in the design the section headings and card
 *     titles are set in the bold sans, so those stay on the DS `--font-sans`.
 *   - **Open Sans body** — mapped to the DS `--font-sans` (Inter). Both are
 *     humanist sans faces; adding a second body font for one page isn't worth
 *     the request.
 *   - **0.78px hairline border** — sub-pixel; rendered as the DS 1px.
 *   - **Breakpoints** — the design's 1199/1024/768/640 map onto Tailwind's
 *     xl/lg/md/sm almost exactly, so DS breakpoints are used throughout.
 *
 * Artwork (card thumbnails, bottom decorative band) has no assets yet: cards
 * fall back to a gradient placeholder, and the band renders its fade structure
 * over a placeholder. Set `thumbnail` on the agent data to fill them in.
 */
@Component({
  selector: 'app-ai-labs',
  imports: [Button, NgIcon, NgOptimizedImage],
  templateUrl: './ai-labs.html',
  styleUrl: './ai-labs.css',
  host: { class: 'ai-labs block' },
})
export class AiLabs {
  protected readonly auth = inject(AiLabsAuth);

  protected readonly sections = AI_LAB_SECTIONS;
  protected readonly copilotIcon = iconCopilot;
  protected readonly sparkleIcon = iconSparkle;
  protected readonly S3_BUCKET_URL = environment.S3_BUCKET_URL;

  protected readonly eyebrow = ['NO CODE', 'Complimentary License', 'NO CLIENT DATA'];

  constructor() {
    void this.auth.restoreSession();
  }

  /**
   * One handler behind the hero button and every card's Launch button: signed
   * out starts the popup sign-in, signed in opens Copilot Studio. Keeping it
   * single means a card click can't diverge from the hero's state.
   *
   * Every card launches the same Copilot Studio environment — `AiLabAgent` has
   * no per-agent destination, so there is nothing to pass through yet. Add a
   * URL (or agent id) to the model and thread it into `launchCopilot` when the
   * agents get individual deep links.
   */
  protected activate(): void {
    if (this.auth.isSignedIn()) {
      this.auth.launchCopilot();
      return;
    }
    void this.auth.signIn();
  }

  /** Forces the Entra account picker, for someone who landed on the wrong one. */
  protected switchAccount(): void {
    void this.auth.signIn({ switchAccount: true });
  }

  protected signOut(): void {
    void this.auth.signOut();
  }
}
