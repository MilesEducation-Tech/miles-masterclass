/** No-op `DialogRef` double for Storybook. */
export class MockDialogRef {
  close = (_result?: any): void => undefined;
}
