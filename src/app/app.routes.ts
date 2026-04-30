import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home/home').then(m => m.HomePage),
    title: 'Sulola daraxti'
  },
  {
    path: 'not-found',
    loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFoundPage),
    title: 'Topilmadi · Sulola daraxti'
  },
  {
    // /:familyName — last so it doesn't shadow other top-level routes.
    path: ':familyName',
    loadComponent: () =>
      import('./pages/family-tree-page/family-tree-page').then(m => m.FamilyTreePage)
  },
  {
    path: '**',
    redirectTo: 'not-found'
  }
];
