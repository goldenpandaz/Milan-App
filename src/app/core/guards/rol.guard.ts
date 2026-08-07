import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Rol } from '../models/dominio.models';

/** admin hereda todo lo de jefe_mesero: si la ruta pide jefe_mesero, admin también entra. */
function tienePermiso(rolUsuario: Rol, rolesPermitidos: Rol[]): boolean {
  if (rolUsuario === 'administrador') return true;
  return rolesPermitidos.includes(rolUsuario);
}

export function rolGuard(...rolesPermitidos: Rol[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const sesion = authService.getSession();

    if (!sesion || sesion.estado !== 'activo' || !sesion.rol) {
      router.navigate(['/pendiente']);
      return false;
    }

    if (!tienePermiso(sesion.rol, rolesPermitidos)) {
      router.navigate(['/app/tareas']);
      return false;
    }

    return true;
  };
}
