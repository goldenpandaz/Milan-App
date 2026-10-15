import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { RtdbService } from './rtdb.service';
import { EstadoUsuario, Rol, Usuario } from '../models/dominio.models';

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

  /** Activar o inactivar a una persona ("despido"). Si era el jefe de meseros, deja de serlo en el mismo guardado. */
  cambiarEstado(usuario: Usuario, estado: EstadoUsuario): Observable<unknown> {
    const cambios: Record<string, unknown> = { [`usuarios/${usuario.uid}/estado`]: estado };
    if (estado === 'inactivo' && usuario.rol === 'jefe_mesero') {
      cambios[`usuarios/${usuario.uid}/rol`] = 'mesero';
    }
    return this.rtdb.patch('', cambios);
  }

  /**
   * Solo hay un jefe de meseros: designar a uno nuevo baja al anterior a mesero, todo en un único guardado
   * para que nunca queden dos jefes (ni ninguno) a mitad de camino.
   */
  designarJefe(uid: string, jefeActualUid: string | null): Observable<unknown> {
    const cambios: Record<string, unknown> = { [`usuarios/${uid}/rol`]: 'jefe_mesero' };
    if (jefeActualUid && jefeActualUid !== uid) cambios[`usuarios/${jefeActualUid}/rol`] = 'mesero';
    return this.rtdb.patch('', cambios);
  }

  quitarJefe(uid: string): Observable<unknown> {
    return this.rtdb.patch(`usuarios/${uid}`, { rol: 'mesero' });
  }

  private aArreglo(obj: Record<string, Omit<Usuario, 'uid'>> | null): Usuario[] {
    if (!obj) return [];
    return Object.entries(obj).map(([uid, value]) => ({ ...value, uid }));
  }
}
