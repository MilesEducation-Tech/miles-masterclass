import { of } from 'rxjs';

export class MockUtils {
  navigateTo() {}
  openDialog() {}
  openVideoDialog() {}
  slugify(text: string) {
    return text.toLowerCase().replace(/\s+/g, '-');
  }
}

export class MockFeatureFacade {
  getAbout(id: number) {
    return of(null);
  }
}

export class MockLogger {
  error(...args: any[]) {}
  warn(...args: any[]) {}
  info(...args: any[]) {}
}

export class MockRouter {
  navigate() {}
  navigateByUrl() {}
}
