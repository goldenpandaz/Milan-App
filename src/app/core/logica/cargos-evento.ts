import { CargoCatalogo, CargoEvento, EstadoTarea, MiembroEquipo, TareaEvento } from '../models/dominio.models';
import { normalizarNombre } from './catalogo';

/** Nombre reservado del cargo de catálogo cuyo titular se asigna solo al jefe de meseros activo. */
export const NOMBRE_CARGO_JEFE = 'jefe de meseros';

interface TareaEventoCruda {
  titulo: string;
  orden: number;
  estado?: EstadoTarea;
  hechoPor?: string | null;
  hechoEn?: number | null;
}

export interface CargoEventoCrudo {
  nombre: string;
  orden: number;
  manejaInvitados?: boolean;
  titularId?: string | null;
  origenCatalogoId?: string | null;
  tareas?: Record<string, TareaEventoCruda>;
}

export type Cambios = Record<string, unknown>;

export function ordenarCargosEvento(raw: Record<string, CargoEventoCrudo> | null): CargoEvento[] {
  if (!raw) return [];
  return Object.entries(raw)
    .map(([id, c]) => ({
      id,
      nombre: c.nombre,
      orden: c.orden,
      manejaInvitados: c.manejaInvitados === true,
      titularId: c.titularId ?? null,
      origenCatalogoId: c.origenCatalogoId ?? null,
      tareas: Object.entries(c.tareas ?? {})
        .map(([tid, t]) => ({ ...t, id: tid, estado: t.estado ?? 'pendiente' }) as TareaEvento)
        .sort((a, b) => a.orden - b.orden),
    }))
    .sort((a, b) => a.orden - b.orden);
}

export function ordenarEquipo(raw: Record<string, Omit<MiembroEquipo, 'id'>> | null): MiembroEquipo[] {
  if (!raw) return [];
  return Object.entries(raw)
    .map(([id, m]) => ({ ...m, id }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Cargo del evento que ya ocupa `titularId` (ignorando `ignorarCargoId`), o null. */
export function cargoDeTitular(cargos: CargoEvento[], titularId: string, ignorarCargoId?: string): CargoEvento | null {
  return cargos.find((c) => c.id !== ignorarCargoId && c.titularId === titularId) ?? null;
}

const base = (eventoId: string) => `eventos/${eventoId}`;

/** Jefe de meseros activo, para sumarlo al equipo y asignarlo como titular del cargo "Jefe de meseros". */
export interface JefeEvento {
  uid: string;
  nombre: string;
}

/**
 * PATCH a la raíz que copia todo el catálogo al evento y marca `catalogoCopiado`, en una sola escritura.
 * El cargo de catálogo "Jefe de meseros" queda asignado de entrada al jefe activo (y lo suma al equipo).
 */
export function cambiosCopiarCatalogo(
  eventoId: string,
  catalogo: CargoCatalogo[],
  nuevoId: () => string,
  jefe: JefeEvento | null = null
): Cambios {
  const cambios: Cambios = { [`${base(eventoId)}/catalogoCopiado`]: true };
  if (jefe) cambios[`${base(eventoId)}/equipo/${jefe.uid}`] = { nombre: jefe.nombre, agregadoPor: jefe.uid, agregadoEn: Date.now() };
  for (const cargo of catalogo) {
    const tareas: Record<string, TareaEventoCruda> = {};
    for (const t of cargo.tareas) tareas[t.id] = { titulo: t.titulo, orden: t.orden, estado: 'pendiente' };
    const esCargoJefe = jefe && normalizarNombre(cargo.nombre) === NOMBRE_CARGO_JEFE;
    const cargoId = nuevoId();
    cambios[`${base(eventoId)}/cargos/${cargoId}`] = {
      nombre: cargo.nombre,
      orden: cargo.orden,
      manejaInvitados: cargo.manejaInvitados,
      titularId: esCargoJefe ? jefe!.uid : null,
      origenCatalogoId: cargo.id,
      tareas,
    };
    if (esCargoJefe) cambios[`${base(eventoId)}/ocupacion/${cargoId}`] = jefe!.uid;
  }
  return cambios;
}

/** Titular y su índice `ocupacion` van juntos; `null` deja el cargo sin responsable. */
export function cambiosAsignarTitular(eventoId: string, cargoId: string, titularId: string | null): Cambios {
  return {
    [`${base(eventoId)}/cargos/${cargoId}/titularId`]: titularId,
    [`${base(eventoId)}/ocupacion/${cargoId}`]: titularId,
  };
}

/** Mueve la tarea (mismo id y estado) de un cargo a otro en un solo PATCH. */
export function cambiosMoverTarea(eventoId: string, origen: CargoEvento, tareaId: string, destinoId: string): Cambios {
  const tarea = origen.tareas.find((t) => t.id === tareaId);
  if (!tarea || origen.id === destinoId) return {};
  const { id, ...datos } = tarea;
  return {
    [`${base(eventoId)}/cargos/${origen.id}/tareas/${id}`]: null,
    [`${base(eventoId)}/cargos/${destinoId}/tareas/${id}`]: datos,
  };
}

export function cambiosEliminarCargo(eventoId: string, cargoId: string): Cambios {
  return {
    [`${base(eventoId)}/cargos/${cargoId}`]: null,
    [`${base(eventoId)}/ocupacion/${cargoId}`]: null,
  };
}

/** Sacar a alguien del equipo también lo quita como titular de cualquier cargo del evento. */
export function cambiosQuitarDelEquipo(eventoId: string, miembroId: string, cargos: CargoEvento[]): Cambios {
  const cambios: Cambios = { [`${base(eventoId)}/equipo/${miembroId}`]: null };
  for (const c of cargos.filter((c) => c.titularId === miembroId)) {
    Object.assign(cambios, cambiosAsignarTitular(eventoId, c.id, null));
  }
  return cambios;
}
