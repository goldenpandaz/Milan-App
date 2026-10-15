import { Injectable } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { RtdbService } from './rtdb.service';
import { CatalogoService, DatosCargo } from './catalogo.service';
import { CargoEvento, MiembroEquipo } from '../models/dominio.models';
import { generarId } from '../logica/id';
import { siguienteOrden } from '../logica/catalogo';
import {
  CargoEventoCrudo,
  cambiosAsignarTitular,
  cambiosCopiarCatalogo,
  cambiosEliminarCargo,
  cambiosMoverTarea,
  cambiosQuitarDelEquipo,
  ordenarCargosEvento,
  ordenarEquipo,
} from '../logica/cargos-evento';

/** Equipo y cargos propios de un evento (copia del catálogo, editable sin tocar el catálogo general). */
@Injectable({ providedIn: 'root' })
export class EventoDetalleService {
  constructor(private rtdb: RtdbService, private catalogo: CatalogoService) {}

  // ---- Equipo ----

  listarEquipo(eventoId: string): Observable<MiembroEquipo[]> {
    return this.rtdb
      .get<Record<string, Omit<MiembroEquipo, 'id'>> | null>(`eventos/${eventoId}/equipo`)
      .pipe(map((raw) => ordenarEquipo(raw)));
  }

  agregarAlEquipo(eventoId: string, uid: string, nombre: string, autor: string): Observable<unknown> {
    return this.rtdb.put(`eventos/${eventoId}/equipo/${uid}`, { nombre, agregadoPor: autor, agregadoEn: Date.now() });
  }

  agregarNoRegistrado(eventoId: string, nombre: string, autor: string): Observable<unknown> {
    return this.rtdb.put(`eventos/${eventoId}/equipo/nr_${generarId()}`, {
      nombre: nombre.trim(),
      noRegistrado: true,
      agregadoPor: autor,
      agregadoEn: Date.now(),
    });
  }

  quitarDelEquipo(eventoId: string, miembroId: string, cargos: CargoEvento[]): Observable<unknown> {
    return this.rtdb.patch('', cambiosQuitarDelEquipo(eventoId, miembroId, cargos));
  }

  // ---- Cargos ----

  listarCargos(eventoId: string): Observable<CargoEvento[]> {
    return this.rtdb
      .get<Record<string, CargoEventoCrudo> | null>(`eventos/${eventoId}/cargos`)
      .pipe(map((raw) => ordenarCargosEvento(raw)));
  }

  /** La primera vez copia el catálogo completo; después nunca más, para no pisar las ediciones del evento. */
  asegurarCopiaCatalogo(eventoId: string): Observable<CargoEvento[]> {
    return this.rtdb.get<boolean | null>(`eventos/${eventoId}/catalogoCopiado`).pipe(
      switchMap((copiado) =>
        copiado
          ? of(null)
          : this.catalogo
              .listar()
              .pipe(switchMap((cat) => this.rtdb.patch('', cambiosCopiarCatalogo(eventoId, cat, generarId))))
      ),
      switchMap(() => this.listarCargos(eventoId))
    );
  }

  crearCargo(eventoId: string, datos: DatosCargo, cargos: CargoEvento[]): Observable<unknown> {
    return this.rtdb.put(`eventos/${eventoId}/cargos/${generarId()}`, {
      nombre: datos.nombre.trim(),
      manejaInvitados: datos.manejaInvitados,
      orden: siguienteOrden(cargos),
      titularId: null,
      origenCatalogoId: null,
    });
  }

  actualizarCargo(eventoId: string, cargoId: string, datos: DatosCargo): Observable<unknown> {
    return this.rtdb.patch(`eventos/${eventoId}/cargos/${cargoId}`, {
      nombre: datos.nombre.trim(),
      manejaInvitados: datos.manejaInvitados,
    });
  }

  eliminarCargo(eventoId: string, cargoId: string): Observable<unknown> {
    return this.rtdb.patch('', cambiosEliminarCargo(eventoId, cargoId));
  }

  asignarTitular(eventoId: string, cargoId: string, titularId: string | null): Observable<unknown> {
    return this.rtdb.patch('', cambiosAsignarTitular(eventoId, cargoId, titularId));
  }

  crearTarea(eventoId: string, cargo: CargoEvento, titulo: string): Observable<unknown> {
    return this.rtdb.put(`eventos/${eventoId}/cargos/${cargo.id}/tareas/${generarId()}`, {
      titulo: titulo.trim(),
      orden: siguienteOrden(cargo.tareas),
      estado: 'pendiente',
    });
  }

  eliminarTarea(eventoId: string, cargoId: string, tareaId: string): Observable<unknown> {
    return this.rtdb.remove(`eventos/${eventoId}/cargos/${cargoId}/tareas/${tareaId}`);
  }

  moverTarea(eventoId: string, origen: CargoEvento, tareaId: string, destinoId: string): Observable<unknown> {
    return this.rtdb.patch('', cambiosMoverTarea(eventoId, origen, tareaId, destinoId));
  }
}
