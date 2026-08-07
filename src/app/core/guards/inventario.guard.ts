import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { EventService } from '../services/event.service';

/** Solo entra el administrador, o quien tenga asignada la tarea de desmontaje del evento vigente. */
export const inventarioGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const eventService = inject(EventService);
  const router = inject(Router);

  const sesion = authService.getSession();
  if (!sesion) {
    router.navigate(['/login']);
    return of(false);
  }
  if (sesion.rol === 'administrador') return of(true);

  return eventService.obtenerVigente().pipe(
    map((evento) => {
      const esAsignado = evento?.desmontajeAsignadoA === sesion.localId;
      if (!esAsignado) {
        router.navigate(['/app/tareas']);
        return false;
      }
      return true;
    })
  );
};
