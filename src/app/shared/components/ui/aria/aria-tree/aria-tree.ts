import { NgTemplateOutlet } from '@angular/common';
import { Tree, TreeItem, TreeItemGroup } from '@angular/aria/tree';
import { Component, computed, input, model, signal } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronRight } from '@ng-icons/heroicons/outline';
import { AriaTreeNode } from '../../../../core/models/aria.model';
import { cn } from '../../../../utils/cn';

/**
 * ARIA-compliant tree built on `@angular/aria/tree`. Pass a recursive
 * `nodes` data structure; the component renders it with proper aria-expanded /
 * aria-selected / aria-level. Implements `FormValueControl<V[]>` for signal-form
 * binding — works for single and multi selection.
 */
@Component({
  selector: 'app-aria-tree',
  imports: [Tree, TreeItem, TreeItemGroup, NgTemplateOutlet, NgIcon],
  templateUrl: './aria-tree.html',
  styleUrl: './aria-tree.css',
  providers: [provideIcons({ heroChevronRight })],
})
export class AriaTree<V = unknown> implements FormValueControl<V[]> {
  readonly id = input<string>('');
  readonly nodes = input<AriaTreeNode<V>[]>([]);
  readonly multi = input(false);
  readonly selectionMode = input<'follow' | 'explicit'>('explicit');
  readonly focusMode = input<'roving' | 'activedescendant'>('roving');
  readonly orientation = input<'vertical' | 'horizontal'>('vertical');
  readonly wrap = input(true);
  readonly softDisabled = input(false);
  readonly nav = input(false);
  readonly currentType = input<'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false'>(
    'true',
  );
  readonly label = input('');
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly userClass = input('', { alias: 'class' });

  // FormValueControl
  readonly value = model<V[]>([]);
  readonly touched = model<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly disabledReasons = input<readonly any[]>([]);
  readonly readonly = input<boolean>(false);
  readonly hidden = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly errors = input<readonly any[]>([]);

  readonly icons = signal({ chevronRight: heroChevronRight });

  readonly displayError = computed(() => this.invalid() && this.errors().length > 0);

  readonly hostClasses = computed(() =>
    cn(
      'list-none p-1 rounded-md border border-border bg-popover text-popover-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
      this.displayError() && 'border-destructive',
      this.userClass(),
    ),
  );

  onValuesChange(values: V[]) {
    this.value.set([...values]);
  }
}
