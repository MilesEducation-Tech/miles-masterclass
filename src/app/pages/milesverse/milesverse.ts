import { isPlatformBrowser } from '@angular/common';
import { Component, type OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideArrowUpRight,
  lucideAudioLines,
  lucideCircleAlert,
  lucideShieldCheck,
  lucideSparkles,
  lucideWifiOff,
} from '@ng-icons/lucide';
import type { Simulation, SubjectGroup } from '@milesverse/sdk';
import { Button } from '@shared/ui/button/button';
import { MilesVerse } from '@core/services/milesverse/milesverse';
import { Utils } from '@shared/services/utils';
import { MILESVERSE_STEPS, seedHue } from './milesverse.model';

/**
 * MilesVerse landing — LIVE subject catalogue over @milesverse/sdk (mmc-develop).
 *
 * The browse flow is subject-first: this lists every subject (from
 * `GET /simulations/by-subject`) as a card carrying its scenario count, and
 * routing into a subject drills down to its scenarios grouped by difficulty
 * tier. Miles AI Labs visual language on Masterclass tokens.
 */
@Component({
  selector: 'app-milesverse',
  imports: [Button, NgIcon, RouterLink],
  templateUrl: './milesverse.html',
  styleUrl: './milesverse.css',
  providers: [
    provideIcons({
      lucideArrowRight,
      lucideArrowUpRight,
      lucideAudioLines,
      lucideCircleAlert,
      lucideShieldCheck,
      lucideSparkles,
      lucideWifiOff,
    }),
  ],
  host: { class: 'milesverse block' },
})
export class Milesverse implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly milesverse = inject(MilesVerse);
  protected readonly utils = inject(Utils);

  protected readonly steps = MILESVERSE_STEPS;
  protected readonly eyebrow = ['Live AI Persona', 'Real Case File', 'Scored Debrief'];
  protected readonly available = this.milesverse.enabled;

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly groups = signal<SubjectGroup[]>([]);
  protected readonly total = signal(0);
  protected readonly brokenArt = signal<ReadonlySet<string>>(new Set());
  protected readonly query = signal('');

  /** Named subjects only (the trailing null "unfiled" group is operator-only). */
  private readonly namedGroups = computed(() => this.groups().filter((g) => g.subject));

  protected readonly visibleGroups = computed(() => {
    const q = this.query().trim().toLowerCase();
    const named = this.namedGroups();
    if (!q) return named;
    return named.filter(
      (g) =>
        g.subject!.title.toLowerCase().includes(q) ||
        (g.subject!.description ?? '').toLowerCase().includes(q),
    );
  });

  /** A single scenario to spotlight in the hero, with its subject label. */
  protected readonly featured = computed<{ sim: Simulation; subjectTitle: string } | null>(() => {
    const group = this.namedGroups().find((g) => g.simulations?.length);
    if (!group?.subject || !group.simulations[0]) return null;
    return { sim: group.simulations[0], subjectTitle: group.subject.title };
  });

  protected readonly stats = computed(() => [
    { value: String(this.total()), label: 'Scenarios' },
    { value: String(this.namedGroups().length), label: 'Subjects' },
    { value: '3', label: 'Difficulty tiers' },
    { value: '5:00', label: 'Minutes per session' },
  ]);

  ngOnInit(): void {
    if (this.available && isPlatformBrowser(this.platformId)) void this.load();
  }

  protected subjectPath(slug: string): string {
    return this.utils.localePath(`simulation/subjects/${slug}`);
  }
  protected briefingPath(id: string): string {
    return this.utils.localePath(`simulation/briefing/${id}`);
  }

  /** Spotlight (featured) art + hue. */
  protected featuredArt(): string | null {
    const f = this.featured();
    if (!f) return null;
    return this.brokenArt().has(f.sim.id)
      ? null
      : this.milesverse.resolveMedia(f.sim.thumbnail_url);
  }
  protected featuredHue(): number {
    const f = this.featured();
    return seedHue(f?.subjectTitle || f?.sim.title || 'milesverse');
  }

  /** Subject cover art resolved to an absolute media URL, or null → fallback. */
  protected art(group: SubjectGroup): string | null {
    const subject = group.subject!;
    return this.brokenArt().has(subject.id)
      ? null
      : this.milesverse.resolveMedia(subject.thumbnail_url);
  }
  protected onArtError(id: string): void {
    this.brokenArt.update((s) => new Set(s).add(id));
  }
  protected initial(group: SubjectGroup): string {
    return (group.subject!.title.charAt(0) || 'M').toUpperCase();
  }
  protected countLabel(group: SubjectGroup): string {
    const n = group.total;
    return `${n} ${n === 1 ? 'scenario' : 'scenarios'}`;
  }

  protected onSearch(value: string): void {
    this.query.set(value);
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const grouped = await this.milesverse.simulationsBySubject();
      this.groups.set(grouped.groups);
      this.total.set(grouped.total);
    } catch {
      this.loadError.set(
        'The MilesVerse catalogue could not be loaded. Check that the MilesVerse API is running.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
