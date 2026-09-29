import { Component, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { Pagination } from './pagination';

@Component({
  selector: 'app-pagination-demo',
  imports: [Pagination],
  template: `
    <div class="flex flex-col items-center gap-3">
      <app-pagination
        ariaLabel="Course pages"
        [page]="page()"
        [pageCount]="7"
        (pageChange)="page.set($event)"
      />
      <p class="text-xs text-muted-foreground">Page {{ page() }} of 7</p>
      <app-pagination ariaLabel="Disabled example" [page]="2" [pageCount]="4" [disabled]="true" />
    </div>
  `,
})
class PaginationDemo {
  readonly page = signal(3);
}

const meta: Meta<PaginationDemo> = {
  title: 'UI/Pagination',
  component: PaginationDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<PaginationDemo>;

export const Default: Story = {};
