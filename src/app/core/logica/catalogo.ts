import { CargoCatalogo } from '../models/dominio.models';

interface TareaCruda {
  titulo: string;
  orden: number;
}

export interface CargoCrudo {
  nombre: string;
  orden: number;
  manejaInvitados?: boolean;
  actualizadoPor: string;
  actualizadoEn: number;
  tareas?: Record<string, TareaCruda>;
}

/** Convierte el árbol de RTDB en cargos con `id`, opciones definidas y tareas ordenadas. */
export function ordenarCatalogo(raw: Record<string, CargoCrudo> | null): CargoCatalogo[] {
  if (!raw) return [];
  return Object.entries(raw)
    .map(([id, cargo]) => ({
      ...cargo,
      id,
      manejaInvitados: cargo.manejaInvitados === true,
      tareas: Object.entries(cargo.tareas ?? {})
        .map(([tareaId, tarea]) => ({ ...tarea, id: tareaId }))
        .sort((a, b) => a.orden - b.orden),
    }))
    .sort((a, b) => a.orden - b.orden);
}

export function siguienteOrden(items: { orden: number }[]): number {
  return Math.max(0, ...items.map((i) => i.orden)) + 1;
}

/** Dos cargos no pueden llamarse igual (sin distinguir mayúsculas, tildes ni espacios de más). */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function nombreRepetido(nombre: string, cargos: Pick<CargoCatalogo, 'id' | 'nombre'>[], ignorarId?: string): boolean {
  const buscado = normalizarNombre(nombre);
  return cargos.some((c) => c.id !== ignorarId && normalizarNombre(c.nombre) === buscado);
}
