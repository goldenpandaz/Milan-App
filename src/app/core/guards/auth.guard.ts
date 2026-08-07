import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  const sesion = authService.getSession()!;
  if (sesion.estado === 'pendiente') {
    router.navigate(['/pendiente']);
    return false;
  }

  return true;
};
