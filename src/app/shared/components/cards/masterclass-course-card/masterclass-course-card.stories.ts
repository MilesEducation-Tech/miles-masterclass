import {
  applicationConfig,
  argsToTemplate,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { provideRouter } from '@angular/router';
import { MasterclassCourse } from '@core/models/masterclass-home.model';
import { Utils } from '@shared/services/utils';
import { MockUtils } from '@testing/mocks/services.mock';
import { MasterclassCourseCard } from './masterclass-course-card';

/** A live-shaped `tracks-page/` course (UUID + slug, thumbnails per layout). */
const course: MasterclassCourse = {
  id: '3f6c1f2e-5b1a-4d7e-9c2b-1a2b3c4d5e6f',
  slug: 'ai-prompting-essentials-for-accountants',
  title: 'AI Prompting Essentials for Accountants',
  short_description:
    'Write prompts that turn ChatGPT and Copilot into reliable accounting assistants.',
  thumbnails: {
    horizontal:
      'https://milesmasterclass-assets.s3.us-west-1.amazonaws.com/static-assests/credly-badges/AI+Prompting+Essentials+for+Accountants.png',
    vertical:
      'https://milesmasterclass-assets.s3.us-west-1.amazonaws.com/static-assests/credly-badges/AI+Prompting+Essentials+for+Accountants.png',
    square: null,
  },
  trailer_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  fields_of_study: [
    { id: '1', name: 'Information Technology', cpe_credit: 1.5 },
    { id: '2', name: 'Accounting', cpe_credit: 1 },
  ],
  total_cpe_credits: 2.5,
  has_individual_badge: true,
  included_for_caira: true,
};

const meta: Meta<MasterclassCourseCard> = {
  title: 'Cards/MasterclassCourseCard',
  component: MasterclassCourseCard,
  tags: ['autodocs'],
  decorators: [
    applicationConfig({ providers: [provideRouter([])] }),
    moduleMetadata({ providers: [{ provide: Utils, useClass: MockUtils }] }),
  ],
  render: (args) => ({
    props: args,
    template: `<div style="width: ${args.layout === 'horizontal' ? '420px' : '240px'};"><app-masterclass-course-card ${argsToTemplate(args)} /></div>`,
  }),
  argTypes: {
    layout: { control: 'select', options: ['vertical', 'horizontal'] },
    trailer: { action: 'trailer' },
  },
};
export default meta;

type Story = StoryObj<MasterclassCourseCard>;

export const Vertical: Story = { args: { course, layout: 'vertical' } };

export const Horizontal: Story = { args: { course, layout: 'horizontal' } };

export const HorizontalNoCredits: Story = {
  args: {
    course: { ...course, total_cpe_credits: null, has_individual_badge: false },
    layout: 'horizontal',
  },
};

export const NoArtwork: Story = {
  args: {
    course: { ...course, thumbnails: { horizontal: null, vertical: null, square: null } },
    layout: 'horizontal',
  },
};
