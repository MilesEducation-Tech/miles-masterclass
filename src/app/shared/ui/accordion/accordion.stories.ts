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
