import { Component, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { FileUpload } from './file-upload';

@Component({
  selector: 'app-file-upload-demo',
  imports: [FileUpload],
  template: `
    <div class="flex w-96 flex-col gap-3">
      <button
        app-file-upload
        types="application/pdf,image/*"
        [multiple]="true"
        (selected)="onSelected($event)"
      >
        <span class="font-medium text-foreground">Drop your certificate here</span>
        <span>PDF or image, up to 10 MB</span>
      </button>
      <p class="text-xs text-muted-foreground">
        Selected: {{ names().join(', ') || 'nothing yet' }}
      </p>
      <button app-file-upload [disabled]="true">Disabled zone</button>
    </div>
  `,
})
class FileUploadDemo {
  readonly names = signal<string[]>([]);

  onSelected(files: FileList | null): void {
    this.names.set(files ? Array.from(files).map((f) => f.name) : []);
  }
}

const meta: Meta<FileUploadDemo> = {
  title: 'UI/FileUpload',
  component: FileUploadDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<FileUploadDemo>;

export const Default: Story = {};
