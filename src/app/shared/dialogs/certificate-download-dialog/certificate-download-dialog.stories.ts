import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { CertificateDownloadDialog } from './certificate-download-dialog';
import { provideStoryDialogRef } from '@testing/mocks/dialog.mock';

const meta: Meta<CertificateDownloadDialog> = {
  title: 'Dialog/CertificateDownload',
  component: CertificateDownloadDialog,
  tags: ['autodocs'],
  decorators: [
    // Spread, so a story's own `moduleMetadata` (its dialog-ref provider) survives the wrapper.
    (story) => {
      const result = story();
      return { ...result, template: `<div style="width: 500px;">${result.template ?? ''}</div>` };
    },
  ],
};

export default meta;
type Story = StoryObj<CertificateDownloadDialog>;

// Note: the dialog now fetches certificates from
// `user-assessment/download_certificate/` on init. In storybook the call
// will fail (no backend), so the NASBA section renders its error state.
// The badge section still renders from `data.badge.acceptUrl`.

export const WithBadge: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        provideStoryDialogRef({
          courseId: 190,
          courseType: 'masterclass',
          badge: {
            acceptUrl: 'https://example.com/badge/accept',
            name: 'AI in Accounting 101',
            image: 'https://example.com/badge.png',
            description: 'Earned by completing AI in Accounting 101.',
          },
        }),
      ],
    }),
  ],
  render: () => ({
    template: `<div style="width: 500px;"><app-certificate-download-dialog /></div>`,
  }),
};

export const NoBadge: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        provideStoryDialogRef({
          courseId: 190,
          courseType: 'masterclass',
        }),
      ],
    }),
  ],
  render: () => ({
    template: `<div style="width: 500px;"><app-certificate-download-dialog /></div>`,
  }),
};
