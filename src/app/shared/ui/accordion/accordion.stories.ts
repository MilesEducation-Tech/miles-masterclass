import type { Meta, StoryObj } from '@storybook/angular';
import { Accordion } from './accordion';
import { AccordionItem } from './accordion-item';

const meta: Meta<Accordion> = {
  title: 'UI/Accordion',
  component: Accordion,
  tags: ['autodocs'],
  render: (args) => ({
    props: args,
    moduleMetadata: { imports: [Accordion, AccordionItem] },
    template: `
      <app-accordion class="w-96" [type]="type" [collapsible]="true">
        <app-accordion-item value="credits" heading="How are CPE credits recorded?">
          Credits post to your tracker as soon as the final assessment is passed.
        </app-accordion-item>
        <app-accordion-item value="certificates" heading="Where is my certificate?">
          Every completed course has a PDF certificate under CPE tracker → Certificates.
        </app-accordion-item>
        <app-accordion-item value="refunds" heading="Refunds" [disabled]="true">
          Not available in this plan.
        </app-accordion-item>
      </app-accordion>
    `,
  }),
  argTypes: { type: { control: 'select', options: ['single', 'multiple'] } },
  args: { type: 'single' },
};

export default meta;
type Story = StoryObj<Accordion>;

export const Single: Story = {};

export const Multiple: Story = { args: { type: 'multiple' } };

/** A badge in the heading, through the `accordionTrailing` slot. */
export const WithTrailing: Story = {
  args: { type: 'multiple' },
  render: (args) => ({
    props: args,
    moduleMetadata: { imports: [Accordion, AccordionItem] },
    template: `
      <app-accordion class="w-96" [type]="type">
        <app-accordion-item value="q1" heading="1. Which standard sets the CPE rules?">
          <span accordionTrailing class="rounded-full bg-success/15 px-3 py-0.5 text-xs font-semibold text-success">Correct</span>
          Your answer: the NASBA/AICPA Statement on Standards for CPE Programs.
        </app-accordion-item>
        <app-accordion-item value="q2" heading="2. How many minutes make one CPE credit?">
          <span accordionTrailing class="rounded-full bg-destructive/15 px-3 py-0.5 text-xs font-semibold text-destructive">Incorrect</span>
          Your answer: 60. Correct answer: 50.
        </app-accordion-item>
      </app-accordion>
    `,
  }),
};
