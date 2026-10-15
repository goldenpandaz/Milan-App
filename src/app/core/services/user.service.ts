import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { RtdbService } from './rtdb.service';
import { Rol, Usuario } from '../models/dominio.models';

export type RolAsignable = Exclude<Rol, 'administrador'>;

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private rtdb: RtdbService) {}

  listarEquipo(): Observable<Usuario[]> {
    return this.rtdb
      .get<Record<string, Omit<Usuario, 'uid'>>>('usuarios')
      .pipe(map((obj) => this.aArreglo(obj)));
  }

  listarActivosPorRol(...roles: Rol[]): Observable<Usuario[]> {
    return this.listarEquipo().pipe(
      map((usuarios) => usuarios.filter((u) => u.estado === 'activo' && u.rol && roles.includes(u.rol)))
    );
  }

  /** El administrador no se asigna desde la UI: solo se alterna entre mesero y jefe_mesero. */
  asignarRol(uid: string, rol: RolAsignable): Observable<unknown> {
    return this.rtdb.patch(`usuarios/${uid}`, { rol });
  }

  private aArreglo(obj: Record<string, Omit<Usuario, 'uid'>> | null): Usuario[] {
    if (!obj) return [];
    return Object.entries(obj).map(([uid, value]) => ({ ...value, uid }));
  }
}
