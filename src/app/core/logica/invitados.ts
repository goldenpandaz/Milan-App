import { InvitadoEvento } from '../models/dominio.models';
import { normalizarNombre } from './catalogo';
import { Cambios } from './cargos-evento';

/** Tope de filas con texto por archivo: ~500 invitados es lo máximo esperado, esto protege de archivos gigantes. */
export const MAX_FILAS_INVITADOS = 600;

export interface InvitadoParseado {
  nombre: string;
  mesa: string | null;
}

export type ResultadoParseo =
  | { ok: true; invitados: InvitadoParseado[] }
  | { ok: false; error: string };

export type InvitadoCrudo = Omit<InvitadoEvento, 'id'>;

/** Nombre para buscar y emparejar: sin tildes, en minúsculas y con espacios colapsados. */
export const normalizarInvitado = normalizarNombre;

function limpiar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

function esTituloMesa(texto: string): boolean {
  return texto.replace(/\s+/g, '').toUpperCase().startsWith('MESA');
}

/**
 * Convierte las celdas de la hoja (una columna) en invitados agrupados por mesa.
 * Una celda que empieza con "MESA" abre una mesa nueva; las demás celdas de texto son invitados de esa mesa.
 * Celdas vacías o que no son texto se ignoran. Sin ningún título, todos quedan con `mesa: null`.
 */
export function parsearCeldasInvitados(celdas: unknown[]): ResultadoParseo {
  const textos = celdas
    .filter((c): c is string => typeof c === 'string')
    .map(limpiar)
    .filter((t) => t.length > 0);

  if (textos.length > MAX_FILAS_INVITADOS) {
    return {
      ok: false,
      error: `El archivo tiene ${textos.length} filas con texto y el máximo es ${MAX_FILAS_INVITADOS}. Revisa que sea la lista correcta.`,
    };
  }

  const invitados: InvitadoParseado[] = [];
  let mesa: string | null = null;
  for (const texto of textos) {
    if (esTituloMesa(texto)) mesa = texto.toUpperCase();
    else invitados.push({ nombre: texto, mesa });
  }
  return { ok: true, invitados };
}

/** Conteo por mesa en el orden en que aparecen (para la previsualización y la vista agrupada). */
export function contarPorMesa(invitados: { mesa: string | null }[]): { mesa: string | null; total: number }[] {
  const conteo = new Map<string | null, number>();
  for (const i of invitados) conteo.set(i.mesa, (conteo.get(i.mesa) ?? 0) + 1);
  return [...conteo.entries()].map(([mesa, total]) => ({ mesa, total }));
}

export function ordenarInvitados(raw: Record<string, InvitadoCrudo> | null): InvitadoEvento[] {
  if (!raw) return [];
  return Object.entries(raw)
    .map(([id, i]) => ({
      id,
      nombre: i.nombre,
      nombreNormalizado: i.nombreNormalizado ?? normalizarInvitado(i.nombre),
      mesa: i.mesa ?? null,
      orden: i.orden ?? 0,
      asistio: i.asistio === true,
      asistioPor: i.asistioPor ?? null,
      asistioEn: i.asistioEn ?? null,
      fueraDeLista: i.fueraDeLista === true,
    }))
    .sort((a, b) => a.orden - b.orden);
}

/** Filtra por nombre ignorando tildes y mayúsculas. */
export function filtrarInvitados<T extends { nombreNormalizado: string }>(invitados: T[], busqueda: string): T[] {
  const q = normalizarInvitado(busqueda);
  return q ? invitados.filter((i) => i.nombreNormalizado.includes(q)) : invitados;
}

const clave = (nombreNormalizado: string, mesa: string | null) => `${nombreNormalizado}|${mesa ?? ''}`;

/**
 * PATCH a la raíz que fusiona la lista nueva con la existente, en una sola escritura:
 * 1) empareja por nombre + mesa; 2) lo que quede, solo por nombre (el invitado cambió de mesa).
 * Los emparejados conservan su asistencia. Los que ya no están: se borran si no habían llegado,
 * y si ya habían llegado se conservan con `fueraDeLista: true`.
 */
export function cambiosSubirInvitados(
  eventoId: string,
  existentes: InvitadoEvento[],
  nuevos: InvitadoParseado[],
  nuevoId: () => string,
  ahora: number,
  archivo: { nombre: string; base64: string; uid: string }
): Cambios {
  const base = `eventos/${eventoId}`;
  const cambios: Cambios = {
    [`${base}/invitadosSubidoEn`]: ahora,
    [`${base}/invitadosArchivo`]: {
      nombre: archivo.nombre,
      base64: archivo.base64,
      subidoPor: archivo.uid,
      subidoEn: ahora,
    },
  };
  const libres = [...existentes];

  const tomar = (pred: (e: InvitadoEvento) => boolean): InvitadoEvento | null => {
    const idx = libres.findIndex(pred);
    return idx === -1 ? null : libres.splice(idx, 1)[0];
  };

  const preparados = nuevos.map((n) => ({ ...n, nombreNormalizado: normalizarInvitado(n.nombre) }));
  const emparejados: (InvitadoEvento | null)[] = preparados.map((n) =>
    tomar((e) => clave(e.nombreNormalizado, e.mesa) === clave(n.nombreNormalizado, n.mesa))
  );
  preparados.forEach((n, i) => {
    if (!emparejados[i]) emparejados[i] = tomar((e) => e.nombreNormalizado === n.nombreNormalizado);
  });

  preparados.forEach((n, i) => {
    const previo = emparejados[i];
    const registro: InvitadoCrudo = {
      nombre: n.nombre,
      nombreNormalizado: n.nombreNormalizado,
      mesa: n.mesa,
      orden: i,
      asistio: previo?.asistio ?? false,
      asistioPor: previo?.asistioPor ?? null,
      asistioEn: previo?.asistioEn ?? null,
    };
    cambios[`${base}/invitados/${previo?.id ?? nuevoId()}`] = registro;
  });

  libres.forEach((sobrante, i) => {
    const ruta = `${base}/invitados/${sobrante.id}`;
    if (!sobrante.asistio) {
      cambios[ruta] = null;
      return;
    }
    const { id: _id, ...resto } = sobrante;
    cambios[ruta] = { ...resto, orden: preparados.length + i, fueraDeLista: true };
  });
  return cambios;
}
