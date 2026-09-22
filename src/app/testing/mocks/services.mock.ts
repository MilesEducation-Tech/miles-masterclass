import { of } from 'rxjs';

export class MockUtils {
  navigateTo() {
    // no-op test double
  }
  openDialog() {
    // no-op test double
  }
  openVideoDialog() {
    // no-op test double
  }
  slugify(text: string) {
    return text.toLowerCase().replace(/\s+/g, '-');
  }
}

export class MockFeatureFacade {
  getAbout(_id: number) {
    return of(null);
  }
}

export class MockLogger {
  error(..._args: any[]) {
    // no-op test double
  }
  warn(..._args: any[]) {
    // no-op test double
  }
  info(..._args: any[]) {
    // no-op test double
  }
}

export class MockRouter {
  navigate() {
    // no-op test double
  }
  navigateByUrl() {
    // no-op test double
  }
}
