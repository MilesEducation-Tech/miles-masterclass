import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  AfterViewInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';
import { debounceTime, distinctUntilChanged, switchMap, startWith, tap } from 'rxjs/operators';
import { DialogRef } from '../../../core/services/dialog/dialog';
import { Utils } from '../../../core/services/utils/utils';
import { GlobalSearch } from '../../../core/services/global-search/global-search';
import { Analytics } from '../../../core/services/analytics/analytics';
import {
  SEARCH_TYPE_TO_URL_SEGMENT,
  SearchCourseType,
  SearchSuggestion,
} from '../../../core/models/search.model';

interface SuggestionGroup {
  type: SearchCourseType;
  label: string;
  items: SearchSuggestion[];
}

const TYPE_LABELS: Record<SearchCourseType, string> = {
  masterclass: 'Master Classes',
  podcast: 'Podcasts',
  micro_learning: 'Micro-Learning',
  nano_learning: 'Micro-Learning',
  webinar: 'Webinars',
};

const TYPE_ORDER: SearchCourseType[] = [
  'masterclass',
  'podcast',
  'micro_learning',
  'nano_learning',
  'webinar',
];

@Component({
  selector: 'app-global-search-dialog',
  imports: [ReactiveFormsModule, NgIcon],
  providers: [provideIcons({ lucideSearch, lucideX })],
  templateUrl: './global-search-dialog.html',
  styleUrl: './global-search-dialog.css',
})
export class GlobalSearchDialog implements AfterViewInit {
  dialogRef!: DialogRef<GlobalSearchDialog>;

  private readonly router = inject(Router);
  private readonly utils = inject(Utils);
  private readonly globalSearch = inject(GlobalSearch);
  private readonly analytics = inject(Analytics);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('searchInput') private readonly searchInput?: ElementRef<HTMLInputElement>;

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly loading = signal(false);
  protected readonly focusedIndex = signal(0);

  protected readonly results = toSignal(
    this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(250),
      distinctUntilChanged(),
      tap(() => this.loading.set(true)),
      switchMap((q) => this.globalSearch.search(q ?? '')),
      tap(() => {
        this.loading.set(false);
        this.focusedIndex.set(0);
      }),
      takeUntilDestroyed(this.destroyRef),
    ),
    { initialValue: [] as SearchSuggestion[] },
  );

  protected readonly groups = computed<SuggestionGroup[]>(() => {
    const grouped = new Map<SearchCourseType, SearchSuggestion[]>();
    for (const item of this.results()) {
      const list = grouped.get(item.type) ?? [];
      list.push(item);
      grouped.set(item.type, list);
    }
    return TYPE_ORDER.filter((t) => grouped.has(t)).map((t) => ({
      type: t,
      label: TYPE_LABELS[t],
      items: grouped.get(t) ?? [],
    }));
  });

  protected readonly flatResults = computed(() => this.groups().flatMap((g) => g.items));

  protected readonly query = toSignal(this.searchControl.valueChanges, { initialValue: '' });

  protected readonly showEmpty = computed(
    () =>
      !this.loading() && (this.query()?.trim().length ?? 0) > 0 && this.flatResults().length === 0,
  );

  protected readonly showPrompt = computed(
    () => (this.query()?.trim().length ?? 0) === 0 && !this.loading(),
  );

  ngAfterViewInit(): void {
    queueMicrotask(() => this.searchInput?.nativeElement.focus());
  }

  protected onKeyDown(event: KeyboardEvent): void {
    const flat = this.flatResults();
    if (!flat.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusedIndex.set(Math.min(this.focusedIndex() + 1, flat.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusedIndex.set(Math.max(this.focusedIndex() - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const picked = flat[this.focusedIndex()];
      if (picked) this.selectResult(picked);
    }
  }

  protected isFocused(item: SearchSuggestion): boolean {
    return this.flatResults()[this.focusedIndex()]?.id === item.id;
  }

  protected selectResult(item: SearchSuggestion): void {
    const segment = SEARCH_TYPE_TO_URL_SEGMENT[item.type] ?? 'masterclass';
    const titleSlug = this.utils.slugify(item.title);
    this.analytics.trackEvent('search', {
      search_term: (this.searchControl.value ?? '').trim(),
      result_id: item.id,
      result_type: item.type,
    });
    this.dialogRef.close();
    this.router.navigate([
      '/',
      this.utils.country(),
      this.utils.profession(),
      segment,
      item.id,
      titleSlug,
    ]);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
