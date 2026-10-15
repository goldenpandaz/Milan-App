import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { RtdbService } from './rtdb.service';
import { CargoCatalogo, TipoCargo } from '../models/dominio.models';
import { generarId } from '../logica/id';
import { CargoCrudo, nombreDeCargoNuevo, ordenarCatalogo, siguienteOrden } from '../logica/catalogo';

/** Catálogo general de cargos y sus tareas. Es independiente de los eventos. */
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  constructor(private rtdb: RtdbService) {}

  listar(): Observable<CargoCatalogo[]> {
    return this.rtdb
      .get<Record<string, CargoCrudo> | null>('catalogo/cargos')
      .pipe(map((raw) => ordenarCatalogo(raw)));
  }

  crearCargo(tipo: TipoCargo, nombre: string, cargos: CargoCatalogo[], uid: string): Observable<unknown> {
    return this.rtdb.put(`catalogo/cargos/${generarId()}`, {
      nombre: nombreDeCargoNuevo(tipo, nombre, cargos),
      tipo,
      orden: siguienteOrden(cargos),
      ...this.huella(uid),
    });
  }

  renombrarCargo(cargoId: string, nombre: string, uid: string): Observable<unknown> {
    return this.rtdb.patch(`catalogo/cargos/${cargoId}`, { nombre: nombre.trim(), ...this.huella(uid) });
  }

  eliminarCargo(cargoId: string): Observable<unknown> {
    return this.rtdb.remove(`catalogo/cargos/${cargoId}`);
  }

  /** La tarea y la huella del cargo se escriben en un solo PATCH, así quedan atómicas. */
  crearTarea(cargo: CargoCatalogo, titulo: string, uid: string): Observable<unknown> {
    return this.rtdb.patch(`catalogo/cargos/${cargo.id}`, {
      [`tareas/${generarId()}`]: { titulo: titulo.trim(), orden: siguienteOrden(cargo.tareas) },
      ...this.huella(uid),
    });
  }

  eliminarTarea(cargoId: string, tareaId: string, uid: string): Observable<unknown> {
    return this.rtdb.patch(`catalogo/cargos/${cargoId}`, { [`tareas/${tareaId}`]: null, ...this.huella(uid) });
  }

  private huella(uid: string): { actualizadoPor: string; actualizadoEn: number } {
    return { actualizadoPor: uid, actualizadoEn: Date.now() };
  }
}
