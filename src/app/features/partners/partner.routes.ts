export const PARTNER_ROUTES = [
  {
    path: 'caira',
    loadComponent: () => import('./pages/caira-landing/caira-landing').then((m) => m.CairaLanding),
  },
  {
    path: 'cpe-for-corporate',
    loadComponent: () =>
      import('./pages/partner-showcase/partner-showcase').then((m) => m.PartnerShowcase),
    resolve: { partner: () => import('./data/corporate').then((m) => m.CORPORATE) },
  },
  {
    path: 'partners',
    children: [
      {
        path: 'boomer-knowledge-network',
        loadComponent: () =>
          import('./pages/partner-showcase/partner-showcase').then((m) => m.PartnerShowcase),
        resolve: { partner: () => import('./data/bkn').then((m) => m.BKN) },
      },
      // {
      //   path: 'alabama-society-of-cpas',
      //   loadComponent: () => import('./pages/ascpa/ascpa').then((m) => m.Ascpa),
      // },
      {
        path: 'connecticut-society-of-cpas',
        loadComponent: () =>
          import('./pages/partner-landing/partner-landing').then((m) => m.PartnerLanding),
        resolve: { partner: () => import('./data/ctcpa').then((m) => m.CTCPA) },
      },
      {
        path: 'delaware-society-of-cpas',
        loadComponent: () =>
          import('./pages/partner-landing/partner-landing').then((m) => m.PartnerLanding),
        resolve: { partner: () => import('./data/dscpa').then((m) => m.DSCPA) },
      },
      {
        path: 'illinois-society-of-cpas',
        loadComponent: () =>
          import('./pages/partner-showcase/partner-showcase').then((m) => m.PartnerShowcase),
        resolve: { partner: () => import('./data/illinois').then((m) => m.ILLINOIS) },
      },
      {
        path: 'hawaii-society-of-cpas',
        loadComponent: () =>
          import('./pages/partner-landing/partner-landing').then((m) => m.PartnerLanding),
        resolve: { partner: () => import('./data/hawaii').then((m) => m.HSCPA) },
      },
      {
        path: 'mgi-world',
        loadComponent: () =>
          import('./pages/partner-landing/partner-landing').then((m) => m.PartnerLanding),
        resolve: { partner: () => import('./data/mgi-world').then((m) => m.MGI_WORLD) },
      },
      {
        path: 'mgi-north-america',
        loadComponent: () =>
          import('./pages/partner-landing/partner-landing').then((m) => m.PartnerLanding),
        resolve: {
          partner: () => import('./data/mgi-north-america').then((m) => m.MGI_NORTH_AMERICA),
        },
      },
      {
        path: 'allinial-global',
        loadComponent: () =>
          import('./pages/partner-landing/partner-landing').then((m) => m.PartnerLanding),
        resolve: { partner: () => import('./data/allinial-global').then((m) => m.ALLINIAL_GLOBAL) },
      },
      {
        path: 'cpacanada',
        loadComponent: () =>
          import('./pages/partner-landing/partner-landing').then((m) => m.PartnerLanding),
        resolve: { partner: () => import('./data/cpa-canada').then((m) => m.CPA_CANADA) },
      },
    ],
  },
];
