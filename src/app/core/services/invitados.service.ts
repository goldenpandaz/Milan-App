import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import leerXlsx from 'read-excel-file/browser';
import { RtdbService } from './rtdb.service';
import { InvitadoEvento, InvitadosArchivo } from '../models/dominio.models';
import { generarId } from '../logica/id';
import {
  InvitadoCrudo,
  InvitadoParseado,
  ResultadoParseo,
  cambiosSubirInvitados,
  ordenarInvitados,
  parsearCeldasInvitados,
} from '../logica/invitados';

/** ~2 MB de archivo original: de sobra para una lista de nombres, protege contra subir algo que no es esto. */
const MAX_BYTES_ARCHIVO = 2 * 1024 * 1024;

/** Lista de invitados de un evento: lectura del .xlsx en el navegador, fusión al re-subir y marca de asistencia. */
@Injectable({ providedIn: 'root' })
export class InvitadosService {
  constructor(private rtdb: RtdbService) {}

  listar(eventoId: string): Observable<InvitadoEvento[]> {
    return this.rtdb
      .get<Record<string, InvitadoCrudo> | null>(`eventos/${eventoId}/invitados`)
      .pipe(map((raw) => ordenarInvitados(raw)));
  }

  archivoActual(eventoId: string): Observable<InvitadosArchivo | null> {
    return this.rtdb.get<InvitadosArchivo | null>(`eventos/${eventoId}/invitadosArchivo`);
  }

  /**
   * Lee la primera hoja y toma, de cada fila, la primera celda con valor (el formato es de una sola columna).
   * También guarda el archivo tal cual (nombre + base64), para poder devolverlo igual al descargar.
   */
  async leerArchivo(archivo: File): Promise<ResultadoParseo & { archivoOriginal?: { nombre: string; base64: string } }> {
    if (archivo.size > MAX_BYTES_ARCHIVO) {
      return { ok: false, error: 'El archivo pesa demasiado. Revisa que sea la lista correcta.' };
    }
    try {
      const [hojas, base64] = await Promise.all([leerXlsx(archivo), this.aBase64(archivo)]);
      const filas = hojas[0]?.data ?? [];
      const celdas = filas.map((fila) => fila.find((c) => c !== null && c !== undefined && c !== '') ?? null);
      const resultado = parsearCeldasInvitados(celdas);
      if (!resultado.ok) return resultado;
      return { ...resultado, archivoOriginal: { nombre: archivo.name, base64 } };
    } catch {
      return { ok: false, error: 'No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) válido.' };
    }
  }

  /** Fusiona con lo existente y escribe todo (lista + archivo original) en un solo PATCH atómico a la raíz. */
  subir(
    eventoId: string,
    existentes: InvitadoEvento[],
    nuevos: InvitadoParseado[],
    archivoOriginal: { nombre: string; base64: string },
    uid: string
  ): Observable<unknown> {
    return this.rtdb.patch(
      '',
      cambiosSubirInvitados(eventoId, existentes, nuevos, generarId, Date.now(), { ...archivoOriginal, uid })
    );
  }

  /** Devuelve el .xlsx guardado como un archivo descargable, exactamente como se subió. */
  descargar(archivo: InvitadosArchivo): void {
    const binario = atob(archivo.base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = archivo.nombre || 'invitados.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  private aBase64(archivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve((lector.result as string).split(',')[1] ?? '');
      lector.onerror = () => reject(lector.error);
      lector.readAsDataURL(archivo);
    });
  }

  /**
   * Marca o desmarca la llegada. `cargoId` es el cargo con lista de invitados del que es titular quien marca
   * (null para admin y jefe): las reglas lo usan para comprobar el permiso sin recorrer todos los cargos.
   */
  marcarAsistencia(eventoId: string, invitadoId: string, asistio: boolean, uid: string, cargoId: string | null): Observable<unknown> {
    return this.rtdb.patch(`eventos/${eventoId}/invitados/${invitadoId}`, {
      asistio,
      asistioPor: uid,
      asistioEn: Date.now(),
      asistioCargo: cargoId,
    });
  }
}
