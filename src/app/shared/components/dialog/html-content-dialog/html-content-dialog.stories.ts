import type { Meta, StoryObj } from '@storybook/angular';
import { HtmlContentDialog } from './html-content-dialog';
import { MockDialogRef } from '../../__mocks__/dialog.mock';

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
  render: () => ({
    props: {
      init(component: HtmlContentDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
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
        };
      },
    },
    template: `
      <div style="width: 600px;">
        <app-html-content-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};

export const PrivacyPolicy: Story = {
  render: () => ({
    props: {
      init(component: HtmlContentDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
          title: 'Privacy Policy',
          htmlContent: `
            <p>We respect your privacy and are committed to protecting your personal data.</p>
            <h4>Data We Collect</h4>
            <p>We collect information you provide directly, such as your name, email, and course progress data.</p>
          `,
        };
      },
    },
    template: `
      <div style="width: 600px;">
        <app-html-content-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};
