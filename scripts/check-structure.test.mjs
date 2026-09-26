// Tests for scripts/check-structure.mjs. Run: node --test scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  check,
  compareCounts,
  compareList,
  deferWithoutPlaceholder,
  inlineStyleCounts,
  nestedShared,
  rootColorTokens,
  routedOutsidePages,
  scssFiles,
  singularFolders,
  suffixedFiles,
  tokenHexCounts,
  v2Paths,
} from './check-structure.mjs';

test('naming: suffixed files and .scss are caught; v20+ names pass', () => {
  assert.deepEqual(
    suffixedFiles([
      'src/app/a/foo/foo.component.ts',
      'src/app/a/bar/bar.ts',
      'src/app/s/x.service.spec.ts',
    ]),
    ['src/app/a/foo/foo.component.ts', 'src/app/s/x.service.spec.ts'],
  );
  assert.deepEqual(scssFiles(['a/x.scss', 'a/y.css']), ['a/x.scss']);
});

test('folders: singular category folders fail unless inside their plural; no shared/ in features', () => {
  assert.deepEqual(singularFolders(['src/app/features/x/component/a/a.ts']), [
    'src/app/features/x/component',
  ]);
  assert.deepEqual(singularFolders(['src/app/core/services/dialog/dialog.ts']), []);
  assert.deepEqual(nestedShared(['src/app/features/x/shared/y.ts', 'src/app/shared/ui/b.ts']), [
    'src/app/features/x/shared',
  ]);
  assert.deepEqual(
    v2Paths(['src/app/features/x-v2/a.ts', 'src/app/admin/partner-platform-v2/a.ts']),
    ['src/app/features/x-v2/a.ts'],
  );
});

test('routes: only loadComponent targets outside pages/, layout and the feature shell count', () => {
  const routes = [
    [
      'src/app/features/pay/pay.routes.ts',
      `loadComponent: () => import('./pages/cart/cart').then((m) => m.Cart),
       loadComponent: () => import('./pay').then((m) => m.Pay),
       loadComponent: () => import('@layout/main/main').then((m) => m.Main),
       resolve: { partner: () => import('./data/x').then((m) => m.X) },
       loadComponent: () => import('./components/wrap/wrap').then((m) => m.Wrap),`,
    ],
  ];
  assert.deepEqual(routedOutsidePages(routes), [
    'src/app/features/pay/pay.routes.ts → ./components/wrap/wrap',
  ]);
});

test('templates: static style counts and @defer placeholders ignore HTML comments', () => {
  const html = [
    [
      'a.html',
      '<div style="color: red"></div><!-- <p style="x"></p> --><b [style.width.px]="w"></b>',
    ],
    [
      'b.html',
      '<!-- @defer { --> @defer (on idle) { <x/> } @placeholder { <div class="h-4"></div> }',
    ],
    ['c.html', '@defer (on viewport) { <x/> }'],
  ];
  assert.deepEqual(inlineStyleCounts(html), { 'a.html': 1 });
  assert.deepEqual(deferWithoutPlaceholder(html), ['c.html (1 @defer, 0 @placeholder)']);
});

test('tokens: :root hex and rgb() values are matched exactly, case-insensitively', () => {
  const tokens = rootColorTokens(
    ':root {\n  --background: rgb(14, 14, 14);\n  --x: #ABC;\n}\n.admin-theme {\n  --background: #07182b;\n}',
  );
  assert.deepEqual(tokens, { '#0e0e0e': '--background', '#aabbcc': '--x' });
  assert.deepEqual(
    tokenHexCounts([['t.html', 'from-[#0E0E0E] bg-[#07182b] text-[#aabbcc]']], tokens),
    { 't.html': 2 },
  );
});

test('ratchet: new findings fail, fixed baseline entries are stale, counts may only go down', () => {
  assert.deepEqual(compareList('L', ['a', 'b'], { a: 'why', c: 'why' }), {
    errors: ['L: b'],
    stale: ['L: c'],
  });
  const counts = compareCounts('C', { x: 3, y: 1 }, { x: { count: 2 }, z: { count: 1 } });
  assert.deepEqual(counts.errors, [
    'C: x has 3 (baseline allows 2)',
    'C: y has 1 (baseline allows 0)',
  ]);
  assert.deepEqual(counts.stale, ['C: z now has 0 (baseline 1)']);
});

test('the repository passes against its committed baseline', () => {
  const { errors, stale } = check();
  assert.deepEqual(errors, []);
  assert.deepEqual(stale, []);
});
