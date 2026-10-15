import { CargoCatalogo, TipoCargo } from '../models/dominio.models';

interface TareaCruda {
  titulo: string;
  orden: number;
}

export interface CargoCrudo {
  nombre: string;
  tipo: TipoCargo;
  orden: number;
  actualizadoPor: string;
  actualizadoEn: number;
  tareas?: Record<string, TareaCruda>;
}

/** Convierte el árbol de RTDB en cargos con `id` y tareas ordenadas. */
export function ordenarCatalogo(raw: Record<string, CargoCrudo> | null): CargoCatalogo[] {
  if (!raw) return [];
  return Object.entries(raw)
    .map(([id, cargo]) => ({
      ...cargo,
      id,
      tareas: Object.entries(cargo.tareas ?? {})
        .map(([tareaId, tarea]) => ({ ...tarea, id: tareaId }))
        .sort((a, b) => a.orden - b.orden),
    }))
    .sort((a, b) => a.orden - b.orden);
}

/** "Mesero N" sigue la numeración existente: no reutiliza huecos, toma el mayor + 1. */
export function siguienteNumeroMesero(cargos: Pick<CargoCatalogo, 'nombre' | 'tipo'>[]): number {
  const numeros = cargos
    .filter((c) => c.tipo === 'mesero')
    .map((c) => Number(c.nombre.match(/(\d+)\s*$/)?.[1] ?? 0));
  return Math.max(0, ...numeros) + 1;
}

export function siguienteOrden(items: { orden: number }[]): number {
  return Math.max(0, ...items.map((i) => i.orden)) + 1;
}

/** Hay un solo cargo de desmontaje en el catálogo. */
export function puedeAgregarDesmontaje(cargos: Pick<CargoCatalogo, 'tipo'>[]): boolean {
  return !cargos.some((c) => c.tipo === 'desmontaje');
}

const NOMBRE_POR_DEFECTO: Record<TipoCargo, string> = {
  mesero: '',
  portero: 'Portero',
  desmontaje: 'Desmontaje',
  libre: '',
};

/** Nombre final de un cargo nuevo: los meseros se autonumeran y portero/desmontaje tienen nombre fijo si no escribes uno. */
export function nombreDeCargoNuevo(
  tipo: TipoCargo,
  escrito: string,
  cargos: Pick<CargoCatalogo, 'nombre' | 'tipo'>[],
): string {
  const nombre = escrito.trim();
  if (nombre) return nombre;
  if (tipo === 'mesero') return `Mesero ${siguienteNumeroMesero(cargos)}`;
  return NOMBRE_POR_DEFECTO[tipo];
}
