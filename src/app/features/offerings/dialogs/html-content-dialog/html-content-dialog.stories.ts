import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HtmlContentDialog } from './html-content-dialog';
import { provideStoryDialogRef } from '@testing/mocks/dialog.mock';

const meta: Meta<HtmlContentDialog> = {
  title: 'Dialog/HtmlContent',
  component: HtmlContentDialog,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 600px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
};

export default meta;
type Story = StoryObj<HtmlContentDialog>;

export const TermsAndConditions: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        provideStoryDialogRef({
          title: 'Terms and Conditions',
          htmlContent: `
          <h3>1. Acceptance of Terms</h3>
          <p>By accessing and using the Miles Education platform, you agree to be bound by these Terms and Conditions.</p>
          <h3>2. User Accounts</h3>
          <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
          <h3>3. Course Access</h3>
          <ul>
            <li>Course access is granted upon successful payment or subscription</li>
            <li>CPE credits are awarded upon completion of required assessments</li>
            <li>Course content may not be redistributed without permission</li>
          </ul>
        `,
        }),
      ],
    }),
  ],
  render: () => ({ template: `<div style="width: 600px;"><app-html-content-dialog /></div>` }),
};

export const PrivacyPolicy: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        provideStoryDialogRef({
          title: 'Privacy Policy',
          htmlContent: `
          <p>We respect your privacy and are committed to protecting your personal data.</p>
          <h4>Data We Collect</h4>
          <p>We collect information you provide directly, such as your name, email, and course progress data.</p>
        `,
        }),
      ],
    }),
  ],
  render: () => ({ template: `<div style="width: 600px;"><app-html-content-dialog /></div>` }),
};
