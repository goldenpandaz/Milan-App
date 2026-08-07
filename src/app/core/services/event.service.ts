import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { RtdbService } from './rtdb.service';
import { Evento, Participante } from '../models/dominio.models';

@Injectable({ providedIn: 'root' })
export class EventService {
  constructor(private rtdb: RtdbService) {}

  listar(): Observable<Evento[]> {
    return this.rtdb
      .get<Record<string, { info: Omit<Evento, 'id'> }>>('eventos')
      .pipe(
        map((obj) => {
          if (!obj) return [];
          return Object.entries(obj)
            .filter(([, value]) => !!value?.info)
            .map(([id, value]) => ({ ...value.info, id }))
            .sort((a, b) => b.fecha.localeCompare(a.fecha));
        })
      );
  }

  obtener(eventoId: string): Observable<Evento> {
    return this.rtdb.get<Omit<Evento, 'id'>>(`eventos/${eventoId}/info`).pipe(
      map((info) => ({ ...info, id: eventoId }))
    );
  }

  /** El evento "activo" del salón: el más próximo que todavía no se marcó finalizado. */
  obtenerVigente(): Observable<Evento | null> {
    return this.listar().pipe(
      map((eventos) => eventos.find((e) => e.estado !== 'finalizado') ?? null)
    );
  }

  crear(datos: Pick<Evento, 'nombre' | 'fecha' | 'horaInicio' | 'horaFin'>, creadoPor: string): Observable<string> {
    const id = this.generarId();
    const info: Omit<Evento, 'id'> = { ...datos, estado: 'programado', creadoPor, creadoEn: Date.now() };
    return this.rtdb.put(`eventos/${id}/info`, info).pipe(map(() => id));
  }

  finalizar(eventoId: string): Observable<unknown> {
    return this.rtdb.patch(`eventos/${eventoId}/info`, { estado: 'finalizado' });
  }

  /** Deshace un "Finalizar" hecho por error. */
  reactivar(eventoId: string): Observable<unknown> {
    return this.rtdb.patch(`eventos/${eventoId}/info`, { estado: 'programado' });
  }

  listarParticipantes(eventoId: string): Observable<Participante[]> {
    return this.rtdb
      .get<Record<string, Participante>>(`eventos/${eventoId}/participantes`)
      .pipe(map((obj) => RtdbService.toArray(obj as any)));
  }

  activarme(eventoId: string, uid: string, nombre: string): Observable<unknown> {
    const participante: Participante = { uid, nombre, activo: true, marcadoEn: Date.now() };
    return this.rtdb.put(`eventos/${eventoId}/participantes/${uid}`, participante);
  }

  desactivarme(eventoId: string, uid: string): Observable<unknown> {
    return this.rtdb.patch(`eventos/${eventoId}/participantes/${uid}`, { activo: false });
  }

  private generarId(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}
