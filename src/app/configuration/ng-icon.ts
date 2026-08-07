import { provideNgIconsConfig, withContentSecurityPolicy } from '@ng-icons/core';
export function provideIconsProvider() {
  return provideNgIconsConfig({}, withContentSecurityPolicy());
}
