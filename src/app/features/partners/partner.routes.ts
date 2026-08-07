export const PARTNER_ROUTES = [
  {
    path: 'caira',
    loadComponent: () =>
      import('./shared/pages/caira-landing/caira-landing').then((m) => m.CairaLanding),
  },
  {
    path: 'cpe-for-corporate',
    loadComponent: () => import('./shared/pages/corporate/corporate').then((m) => m.Corporate),
  },
  {
    path: 'partners',
    children: [
      {
        path: 'boomer-knowledge-network',
        loadComponent: () => import('./shared/pages/bkn/bkn').then((m) => m.Bkn),
      },
      // {
      //   path: 'alabama-society-of-cpas',
      //   loadComponent: () => import('./pages/ascpa/ascpa').then((m) => m.Ascpa),
      // },
      {
        path: 'connecticut-society-of-cpas',
        loadComponent: () => import('./shared/pages/ctcpa/ctcpa').then((m) => m.Ctcpa),
      },
      {
        path: 'delaware-society-of-cpas',
        loadComponent: () => import('./shared/pages/dscpa/dscpa').then((m) => m.Dscpa),
      },
      {
        path: 'illinois-society-of-cpas',
        loadComponent: () => import('./shared/pages/illinois/illinois').then((m) => m.Illinois),
      },
      {
        path: 'hawaii-society-of-cpas',
        loadComponent: () => import('./shared/pages/hawaii/hawaii').then((m) => m.Hawaii),
      },
      {
        path: 'mgi-world',
        loadComponent: () => import('./shared/pages/mgi-world/mgi-world').then((m) => m.MgiWorld),
      },
      {
        path: 'mgi-north-america',
        loadComponent: () =>
          import('./shared/pages/mgi-north-america/mgi-north-america').then(
            (m) => m.MGINorthAmerica,
          ),
      },
      {
        path: 'allinial-global',
        loadComponent: () =>
          import('./shared/pages/allinial-global/allinial-global').then((m) => m.AllinialGlobal),
      },
    ],
  },
];
