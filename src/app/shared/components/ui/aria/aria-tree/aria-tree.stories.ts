import type { Meta, StoryObj } from '@storybook/angular';
import { AriaTree } from './aria-tree';
import { AriaTreeNode } from '../../../../core/models/aria.model';

const meta: Meta<AriaTree> = {
  title: 'UI/Aria/Tree',
  component: AriaTree,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      template: `<div style="width: 360px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    multi: { control: 'boolean' },
    selectionMode: { control: 'select', options: ['follow', 'explicit'] },
    focusMode: { control: 'select', options: ['roving', 'activedescendant'] },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<AriaTree>;

const NODES: AriaTreeNode<string>[] = [
  {
    value: 'masterclass',
    label: 'Masterclass',
    children: [
      { value: 'cpa-prep', label: 'CPA Prep' },
      { value: 'cma-prep', label: 'CMA Prep' },
      {
        value: 'specialty',
        label: 'Specialty',
        children: [
          { value: 'ifrs', label: 'IFRS' },
          { value: 'forensic', label: 'Forensic Accounting' },
        ],
      },
    ],
  },
  {
    value: 'micro-learning',
    label: 'Micro-learning',
    children: [
      { value: 'reels-tax', label: 'Tax reels' },
      { value: 'reels-audit', label: 'Audit reels' },
    ],
  },
  { value: 'podcasts', label: 'Podcasts' },
];

export const Single: Story = {
  args: {
    nodes: NODES,
    label: 'Browse catalog',
  },
};

export const Multi: Story = {
  args: {
    nodes: NODES,
    multi: true,
    label: 'Pick categories',
  },
};

export const Disabled: Story = {
  args: {
    nodes: NODES,
    disabled: true,
    label: 'Browse catalog',
  },
};
