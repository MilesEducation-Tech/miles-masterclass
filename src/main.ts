import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Swiper's custom elements are registered lazily by the carousel component
// (see `shared/utils/swiper/ensure-swiper-element.ts`) so
// `swiper/element` (~90 kB) stays out of the initial bundle — carousels only
// ever render inside lazy feature routes.

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
