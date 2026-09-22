import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  type OnInit,
  PLATFORM_ID,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDown,
  lucideArrowLeft,
  lucideArrowUpRight,
  lucideAudioLines,
  lucideChevronLeft,
  lucideChevronRight,
  lucideSearchX,
  lucideGraduationCap,
} from '@ng-icons/lucide';
import type { Simulation, SubjectGroup } from '@milesverse/sdk';
import { Button } from '@shared/ui/button/button';
import { MilesVerse } from '@core/services/milesverse/milesverse';
import { Utils } from '@shared/services/utils';
import { DIFFICULTY_TIERS, seedHue } from '../milesverse.model';
import { difficultyColor } from '../shared/report.model';

/** A difficulty tier paired with the simulations it holds for this subject. */
interface TierRow {
  key: string;
  label: string;
  level: number;
  blurb: string;
  sims: Simulation[];
}

/**
 * MilesVerse subject page — one subject's scenarios, grouped by authored
 * difficulty tier (Foundational → Intermediate → Advanced). This is the middle
 * step of the browse funnel: landing (subjects) → here (a subject's scenarios by
 * difficulty) → briefing. Fed live from `GET /simulations/by-subject`, which the
 * SDK exposes grouped; this picks the group whose subject slug matches the route.
 */
@Component({
  selector: 'app-milesverse-subject',
  imports: [Button, NgIcon, RouterLink],
  templateUrl: './subject.html',
  styleUrls: ['../milesverse.css', './subject.css'],
  providers: [
    provideIcons({
      lucideArrowDown,
      lucideArrowLeft,
      lucideArrowUpRight,
      lucideAudioLines,
      lucideChevronLeft,
      lucideChevronRight,
      lucideSearchX,
      lucideGraduationCap,
    }),
  ],
  host: { class: 'milesverse block' },
})
export class MilesverseSubject implements OnInit {
  readonly slug = input<string>('');

  private readonly platformId = inject(PLATFORM_ID);
  private readonly milesverse = inject(MilesVerse);
  protected readonly utils = inject(Utils);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly group = signal<SubjectGroup | null>(null);
  protected readonly brokenArt = signal<ReadonlySet<string>>(new Set());

  protected readonly subject = computed(() => this.group()?.subject ?? null);

  /** The subject's scenarios grouped into the three tiers, empty tiers dropped. */
  protected readonly tiers = computed<TierRow[]>(() => {
    const sims = this.group()?.simulations ?? [];
    return DIFFICULTY_TIERS.map((t) => ({
      key: t.key,
      label: t.label,
      level: t.level,
      blurb: t.blurb,
      sims: sims.filter((s) => s.difficulty === t.key),
    })).filter((row) => row.sims.length);
  });

  /** Any scenarios whose difficulty isn't one of the three tiers — never lost. */
  protected readonly untiered = computed<Simulation[]>(() => {
    const keys = new Set<string>(DIFFICULTY_TIERS.map((t) => t.key));
    return (this.group()?.simulations ?? []).filter(
      (s) => !s.difficulty || !keys.has(s.difficulty),
    );
  });

  protected readonly backPath = computed(() => this.utils.localePath('simulation'));

  /** Tier accent: green / blue / gold by difficulty. */
  protected readonly tierColor = difficultyColor;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId) && this.milesverse.enabled) void this.load();
  }

  protected briefingPath(id: string): string {
    return this.utils.localePath(`simulation/briefing/${id}`);
  }

  /** Card art: the scenario's own key art, or null → the monogram tile. */
  protected art(sim: Simulation): string | null {
    if (this.brokenArt().has(sim.id)) return null;
    return this.milesverse.resolveMedia(sim.thumbnail_url);
  }
  protected onArtError(id: string): void {
    this.brokenArt.update((s) => new Set(s).add(id));
  }
  protected initial(sim: Simulation): string {
    return (sim.title?.charAt(0) || 'M').toUpperCase();
  }
  /** Per-scenario hue for the monogram tile — same seeding as the briefing hero. */
  protected hue(sim: Simulation): number {
    return seedHue(sim.title || sim.id);
  }

  /** Scroll a tier row most of one viewport left (-1) or right (+1). */
  protected scrollRow(row: HTMLElement, direction: number): void {
    row.scrollBy({ left: direction * row.clientWidth * 0.85, behavior: 'smooth' });
  }

  /** Smooth-scroll to a tier section from the hero jump chips. */
  protected jumpTo(id: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const grouped = await this.milesverse.simulationsBySubject();
      const match = grouped.groups.find((g) => g.subject?.slug === this.slug()) ?? null;
      if (!match) {
        this.error.set('This subject could not be found.');
      }
      this.group.set(match);
    } catch {
      this.error.set('This subject could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
}
