import { Routes } from '@angular/router';
import { UserLoaderGuard } from './services/user-loader.guard';
import { HomeComponent } from './home.component';

export const appRoutes: Routes = [
  {
    path: '',
    canActivate: [UserLoaderGuard],
    children: [
      {
        path: '',
        component: HomeComponent,
      },
      {
        path: 'security',
        loadChildren: () => import('@eternal/user').then((m) => m.userRoutes),
      },
      {
        path: 'customers',
        loadChildren: () =>
          import('@eternal/customers/feature').then((m) => m.customersRoutes),
      },
      {
        path: 'bookings',
        loadChildren: () =>
          import('@eternal/bookings').then((m) => m.bookingsRoutes),
      },
      {
        path: 'holidays',
        loadChildren: () =>
          import('@eternal/holidays/feature').then((m) => m.holidaysRoutes),
      },
      {
        path: 'diary',
        loadChildren: () =>
          import('@eternal/diary/feature').then((m) => m.diaryRoutes),
      },
    ],
  },
];
