import type { Meta, StoryObj } from '@storybook/angular';
import { Marquee } from './marquee';

const meta: Meta<Marquee> = {
  title: 'Components/Marquee',
  component: Marquee,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    direction: {
      control: 'select',
      options: ['left', 'right', 'up', 'down'],
      description: 'Scroll direction',
    },
    speed: {
      control: { type: 'range', min: 10, max: 200, step: 10 },
      description: 'Scroll speed (px/s)',
    },
    pauseOnHover: { control: 'boolean', description: 'Pause animation on hover' },
    play: { control: 'boolean', description: 'Whether the marquee is playing' },
    gradient: { control: 'boolean', description: 'Show fade gradient on edges' },
    autoFill: { control: 'boolean', description: 'Auto-fill to cover container width' },
  },
};

export default meta;
type Story = StoryObj<Marquee>;

export const Default: Story = {
  args: {
    direction: 'left',
    speed: 50,
    pauseOnHover: true,
    play: true,
  },
  render: (args) => ({
    props: args,
    template: `
      <app-marquee [direction]="'left'" [speed]="50" [pauseOnHover]="true" [play]="true">
        <ng-template>
          <div class="flex items-center gap-8 px-4">
            <span class="text-lg font-semibold text-foreground whitespace-nowrap">CPA Exam Prep</span>
            <span class="text-muted-foreground">•</span>
            <span class="text-lg font-semibold text-foreground whitespace-nowrap">CMA Review</span>
            <span class="text-muted-foreground">•</span>
            <span class="text-lg font-semibold text-foreground whitespace-nowrap">EA Fundamentals</span>
            <span class="text-muted-foreground">•</span>
            <span class="text-lg font-semibold text-foreground whitespace-nowrap">CIA Preparation</span>
            <span class="text-muted-foreground">•</span>
            <span class="text-lg font-semibold text-foreground whitespace-nowrap">ACCA Training</span>
            <span class="text-muted-foreground">•</span>
          </div>
        </ng-template>
      </app-marquee>
    `,
  }),
};

export const RightDirection: Story = {
  render: () => ({
    template: `
      <app-marquee direction="right" [speed]="40" [pauseOnHover]="true">
        <ng-template>
          <div class="flex items-center gap-8 px-4">
            <span class="text-lg text-accent whitespace-nowrap">Financial Reporting</span>
            <span class="text-muted-foreground">•</span>
            <span class="text-lg text-accent whitespace-nowrap">Auditing Standards</span>
            <span class="text-muted-foreground">•</span>
            <span class="text-lg text-accent whitespace-nowrap">Tax Planning</span>
            <span class="text-muted-foreground">•</span>
            <span class="text-lg text-accent whitespace-nowrap">Business Law</span>
            <span class="text-muted-foreground">•</span>
          </div>
        </ng-template>
      </app-marquee>
    `,
  }),
};

export const SlowSpeed: Story = {
  render: () => ({
    template: `
      <app-marquee direction="left" [speed]="20">
        <ng-template>
          <div class="flex items-center gap-12 px-4">
            <div class="bg-card px-6 py-3 rounded-lg whitespace-nowrap">
              <span class="text-foreground font-medium">4.8★ Advanced CPA Strategies</span>
            </div>
            <div class="bg-card px-6 py-3 rounded-lg whitespace-nowrap">
              <span class="text-foreground font-medium">4.9★ Ethics in Accounting</span>
            </div>
            <div class="bg-card px-6 py-3 rounded-lg whitespace-nowrap">
              <span class="text-foreground font-medium">4.7★ Tax Season Podcast</span>
            </div>
          </div>
        </ng-template>
      </app-marquee>
    `,
  }),
};

export const Paused: Story = {
  render: () => ({
    template: `
      <app-marquee direction="left" [speed]="50" [play]="false">
        <ng-template>
          <div class="flex items-center gap-8 px-4">
            <span class="text-lg text-foreground whitespace-nowrap">This marquee is paused</span>
            <span class="text-muted-foreground">•</span>
            <span class="text-lg text-foreground whitespace-nowrap">Toggle play to start</span>
            <span class="text-muted-foreground">•</span>
          </div>
        </ng-template>
      </app-marquee>
    `,
  }),
};
