import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Punto de entrada '/': decide a dónde mandar según el estado de la sesión. */
export const inicioGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  const sesion = authService.getSession()!;
  router.navigate([sesion.estado === 'pendiente' ? '/pendiente' : '/app']);
  return false;
};
