/**
 * No-op service doubles for Storybook. Each method returns `undefined`
 * explicitly rather than having an empty body, so `no-empty-function` can stay
 * on for real code.
 */

export class MockUtils {
  navigateTo = (): void => undefined;
  openDialog = (): void => undefined;
  openVideoDialog = (): void => undefined;
  slugify(text: string) {
    return text.toLowerCase().replace(/\s+/g, '-');
  }
}

export class MockLogger {
  error = (..._args: any[]): void => undefined;
  warn = (..._args: any[]): void => undefined;
  info = (..._args: any[]): void => undefined;
}

export class MockRouter {
  navigate = (): void => undefined;
  navigateByUrl = (): void => undefined;
}
