import { Injectable } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { RtdbService } from './rtdb.service';
import { EstadoTarea, Tarea, TipoTarea } from '../models/dominio.models';

export interface CargaMesero {
  uid: string;
  total: number;
  hechas: number;
  porcentaje: number;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  constructor(private rtdb: RtdbService) {}

  listar(eventoId: string): Observable<Tarea[]> {
    return this.rtdb
      .get<Record<string, Omit<Tarea, 'id'>>>(`eventos/${eventoId}/tareas`)
      .pipe(map((obj) => RtdbService.toArray(obj).sort((a, b) => a.creadoEn - b.creadoEn)));
  }

  crear(eventoId: string, titulo: string, tipo: TipoTarea, creadoPor: string): Observable<string> {
    const id = this.generarId();
    const tarea: Omit<Tarea, 'id'> = {
      titulo,
      tipo,
      asignadoA: null,
      estado: 'pendiente',
      creadoPor,
      creadoEn: Date.now(),
    };
    return this.rtdb.put(`eventos/${eventoId}/tareas/${id}`, tarea).pipe(map(() => id));
  }

  eliminar(eventoId: string, tareaId: string): Observable<unknown> {
    return this.rtdb.remove(`eventos/${eventoId}/tareas/${tareaId}`);
  }

  asignar(eventoId: string, tareaId: string, uid: string | null, tipo: TipoTarea): Observable<unknown> {
    const asignar$ = this.rtdb.patch(`eventos/${eventoId}/tareas/${tareaId}`, { asignadoA: uid });
    if (tipo !== 'desmontaje') return asignar$;

    // Puntero denormalizado: las reglas de seguridad lo usan para dar acceso al inventario
    // sin tener que escanear todas las tareas del evento.
    return asignar$.pipe(
      switchMap(() => this.rtdb.patch(`eventos/${eventoId}/info`, { desmontajeAsignadoA: uid }))
    );
  }

  marcarEstado(eventoId: string, tareaId: string, estado: EstadoTarea): Observable<unknown> {
    return this.rtdb.patch(`eventos/${eventoId}/tareas/${tareaId}`, { estado });
  }

  /** % de carga de trabajo por mesero, para que el jefe de meseros reparta parejo. */
  static calcularCarga(tareas: Tarea[]): CargaMesero[] {
    const porUid = new Map<string, { total: number; hechas: number }>();
    for (const t of tareas) {
      if (!t.asignadoA) continue;
      const actual = porUid.get(t.asignadoA) ?? { total: 0, hechas: 0 };
      actual.total += 1;
      if (t.estado === 'hecho') actual.hechas += 1;
      porUid.set(t.asignadoA, actual);
    }
    const totalGeneral = tareas.filter((t) => t.asignadoA).length || 1;
    return Array.from(porUid.entries()).map(([uid, v]) => ({
      uid,
      total: v.total,
      hechas: v.hechas,
      porcentaje: Math.round((v.total / totalGeneral) * 100),
    }));
  }

  private generarId(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}
