import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Solo deja entrar a /pendiente a quien realmente está esperando aprobación. */
export const pendienteGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  const sesion = authService.getSession()!;
  if (sesion.estado === 'activo') {
    router.navigate(['/app']);
    return false;
  }

  return true;
};
