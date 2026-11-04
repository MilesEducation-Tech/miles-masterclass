// The Zoom Meeting SDK's UMD build, mapped in `tsconfig.json` `paths` (the note there says why the
// room loads it instead of the package's ESM build). It ships no types of its own, so it borrows the
// package's. It is CommonJS: an `import()` of it reliably yields only `default`, its `exports`
// object. A named `ZoomMtg` export depends on the bundler's interop, so none is declared.

declare module '@zoom/meetingsdk/umd' {
  import type { ZoomMtg } from '@zoom/meetingsdk';

  const umd: { readonly ZoomMtg: typeof ZoomMtg };
  export default umd;
}
