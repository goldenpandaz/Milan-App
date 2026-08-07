import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { pendienteGuard } from './core/guards/pendiente.guard';
import { inicioGuard } from './core/guards/inicio.guard';
import { rolGuard } from './core/guards/rol.guard';
import { inventarioGuard } from './core/guards/inventario.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [inicioGuard],
    children: [],
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component'),
  },
  {
    path: 'registro',
    loadComponent: () => import('./auth/register/register.component'),
  },
  {
    path: 'pendiente',
    canActivate: [pendienteGuard],
    loadComponent: () => import('./auth/pendiente/pendiente.component'),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/components/layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      { path: '', redirectTo: 'eventos', pathMatch: 'full' },
      { path: 'eventos', loadComponent: () => import('./page/eventos/eventos.component') },
      { path: 'tareas', loadComponent: () => import('./page/tareas/tareas.component') },
      {
        path: 'tareas/asignar',
        canActivate: [rolGuard('jefe_mesero')],
        loadComponent: () => import('./page/tareas/asignar/asignar.component'),
      },
      {
        path: 'inventario',
        canActivate: [inventarioGuard],
        loadComponent: () => import('./page/inventario/inventario.component'),
      },
      {
        path: 'admin/pendientes',
        canActivate: [rolGuard('administrador')],
        loadComponent: () => import('./page/admin/pendientes/pendientes.component'),
      },
      {
        path: 'admin/equipo',
        canActivate: [rolGuard('administrador')],
        loadComponent: () => import('./page/admin/equipo/equipo.component'),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
