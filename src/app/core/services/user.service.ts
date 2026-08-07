import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { RtdbService } from './rtdb.service';
import { Rol, Usuario } from '../models/dominio.models';

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private rtdb: RtdbService) {}

  listarEquipo(): Observable<Usuario[]> {
    return this.rtdb
      .get<Record<string, Omit<Usuario, 'uid'>>>('usuarios')
      .pipe(map((obj) => this.aArreglo(obj)));
  }

  listarPendientes(): Observable<Usuario[]> {
    return this.listarEquipo().pipe(map((usuarios) => usuarios.filter((u) => u.estado === 'pendiente')));
  }

  listarActivosPorRol(...roles: Rol[]): Observable<Usuario[]> {
    return this.listarEquipo().pipe(
      map((usuarios) => usuarios.filter((u) => u.estado === 'activo' && u.rol && roles.includes(u.rol)))
    );
  }

  asignarRol(uid: string, rol: Rol): Observable<unknown> {
    return this.rtdb.patch(`usuarios/${uid}`, { rol, estado: 'activo' });
  }

  quitarAcceso(uid: string): Observable<unknown> {
    return this.rtdb.patch(`usuarios/${uid}`, { rol: null, estado: 'pendiente' });
  }

  private aArreglo(obj: Record<string, Omit<Usuario, 'uid'>> | null): Usuario[] {
    if (!obj) return [];
    return Object.entries(obj).map(([uid, value]) => ({ ...value, uid }));
  }
}
