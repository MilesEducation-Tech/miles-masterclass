// Lazy-registers Swiper's custom elements (`<swiper-container>` / `<swiper-slide>`)
// so `swiper/element` (~90 kB) stays out of the initial bundle. Modules are
// passed as JS by the consumer (`swiper/modules`), and their stylesheets with
// them — see `PAGINATION_STYLES` in carousel.ts.
//
// Carousels only ever render in lazy feature routes, so registration is deferred
// to the moment a component is about to initialize its
// <swiper-container init="false">.
//
// Idempotent: the import()/register() runs at most once (promise is cached), and
// swiper's own register() guards against re-defining the elements.
let registered: Promise<void> | null = null;

export function ensureSwiperElement(): Promise<void> {
  // SSR no-op — swiper elements only register in the browser (matches the old
  // browser-only registration that lived in main.ts).
  if (typeof customElements === 'undefined') return Promise.resolve();
  if (!registered) {
    registered = import('swiper/element').then(({ register }) => register());
  }
  return registered;
}
