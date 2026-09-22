import type { Meta, StoryObj } from '@storybook/angular';
import { CertificateDownloadDialog } from './certificate-download-dialog';
import { MockDialogRef } from '@testing/mocks/dialog.mock';

const meta: Meta<CertificateDownloadDialog> = {
  title: 'Dialog/CertificateDownload',
  component: CertificateDownloadDialog,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 500px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
};

export default meta;
type Story = StoryObj<CertificateDownloadDialog>;

// Note: the dialog now fetches certificates from
// `user-assessment/download_certificate/` on init. In storybook the call
// will fail (no backend), so the NASBA section renders its error state.
// The badge section still renders from `data.badge.acceptUrl`.

export const WithBadge: Story = {
  render: () => ({
    props: {
      init(component: CertificateDownloadDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
          courseId: 190,
          courseType: 'masterclass',
          badge: {
            acceptUrl: 'https://example.com/badge/accept',
            name: 'AI in Accounting 101',
            image: 'https://example.com/badge.png',
            description: 'Earned by completing AI in Accounting 101.',
          },
        };
      },
    },
    template: `
      <div style="width: 500px;">
        <app-certificate-download-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};

export const NoBadge: Story = {
  render: () => ({
    props: {
      init(component: CertificateDownloadDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
          courseId: 190,
          courseType: 'masterclass',
        };
      },
    },
    template: `
      <div style="width: 500px;">
        <app-certificate-download-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};
