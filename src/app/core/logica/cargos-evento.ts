import { CargoCatalogo, CargoEvento, EstadoTarea, MiembroEquipo, TareaEvento } from '../models/dominio.models';

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

/** PATCH a la raíz que copia todo el catálogo al evento y marca `catalogoCopiado`, en una sola escritura. */
export function cambiosCopiarCatalogo(eventoId: string, catalogo: CargoCatalogo[], nuevoId: () => string): Cambios {
  const cambios: Cambios = { [`${base(eventoId)}/catalogoCopiado`]: true };
  for (const cargo of catalogo) {
    const tareas: Record<string, TareaEventoCruda> = {};
    for (const t of cargo.tareas) tareas[t.id] = { titulo: t.titulo, orden: t.orden, estado: 'pendiente' };
    cambios[`${base(eventoId)}/cargos/${nuevoId()}`] = {
      nombre: cargo.nombre,
      orden: cargo.orden,
      manejaInvitados: cargo.manejaInvitados,
      titularId: null,
      origenCatalogoId: cargo.id,
      tareas,
    };
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
