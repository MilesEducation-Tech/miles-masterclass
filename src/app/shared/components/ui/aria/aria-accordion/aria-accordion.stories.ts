import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { AriaAccordionGroup } from './aria-accordion-group';
import { AriaAccordionItem } from './aria-accordion-item';
import { AriaAccordionTrigger } from './aria-accordion-trigger';
import { AriaAccordionPanel } from './aria-accordion-panel';

const meta: Meta<AriaAccordionGroup> = {
  title: 'UI/Aria/Accordion',
  component: AriaAccordionGroup,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [AriaAccordionGroup, AriaAccordionItem, AriaAccordionTrigger, AriaAccordionPanel],
    }),
  ],
};

export default meta;
type Story = StoryObj<AriaAccordionGroup>;

export const Basic: Story = {
  render: () => ({
    template: `
      <app-aria-accordion-group class="w-96">
        <app-aria-accordion-item>
          <button appAriaAccordionTrigger [panel]="p1.panel" type="button">
            What is Miles Masterclass?
          </button>
          <app-aria-accordion-panel #p1="appAriaAccordionPanel">
            <p class="text-sm text-muted-foreground px-1 pb-2">
              An AI-powered CPE learning platform for accounting professionals.
            </p>
          </app-aria-accordion-panel>
        </app-aria-accordion-item>

        <app-aria-accordion-item>
          <button appAriaAccordionTrigger [panel]="p2.panel" type="button">
            How do I earn CPE credits?
          </button>
          <app-aria-accordion-panel #p2="appAriaAccordionPanel">
            <p class="text-sm text-muted-foreground px-1 pb-2">
              Watch at least 95% of each chapter and pass the chapter quiz.
            </p>
          </app-aria-accordion-panel>
        </app-aria-accordion-item>

        <app-aria-accordion-item>
          <button appAriaAccordionTrigger [panel]="p3.panel" type="button">
            Can I download a certificate?
          </button>
          <app-aria-accordion-panel #p3="appAriaAccordionPanel">
            <p class="text-sm text-muted-foreground px-1 pb-2">
              Yes — once the course is complete you can download a PDF certificate.
            </p>
          </app-aria-accordion-panel>
        </app-aria-accordion-item>
      </app-aria-accordion-group>
    `,
  }),
};

export const MultiExpandable: Story = {
  render: () => ({
    template: `
      <app-aria-accordion-group [multiExpandable]="true" class="w-96">
        <app-aria-accordion-item>
          <button appAriaAccordionTrigger [panel]="p1.panel" type="button">Section 1</button>
          <app-aria-accordion-panel #p1="appAriaAccordionPanel">
            <p class="text-sm text-muted-foreground px-1 pb-2">Content for section one.</p>
          </app-aria-accordion-panel>
        </app-aria-accordion-item>
        <app-aria-accordion-item>
          <button appAriaAccordionTrigger [panel]="p2.panel" type="button">Section 2</button>
          <app-aria-accordion-panel #p2="appAriaAccordionPanel">
            <p class="text-sm text-muted-foreground px-1 pb-2">Content for section two.</p>
          </app-aria-accordion-panel>
        </app-aria-accordion-item>
      </app-aria-accordion-group>
    `,
  }),
};
