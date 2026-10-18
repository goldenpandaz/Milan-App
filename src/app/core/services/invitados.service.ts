import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import leerXlsx from 'read-excel-file/browser';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { RtdbService } from './rtdb.service';
import { ItemPdf, celdasDesdePaginasPdf } from '../logica/invitados-pdf';
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
const MAX_PAGINAS_PDF = 30;

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
    const esPdf = archivo.name.toLowerCase().endsWith('.pdf');
    try {
      const [celdas, base64] = await Promise.all([
        esPdf ? this.celdasDePdf(archivo) : this.celdasDeExcel(archivo),
        this.aBase64(archivo),
      ]);
      const resultado = parsearCeldasInvitados(celdas);
      if (!resultado.ok) return resultado;
      return { ...resultado, archivoOriginal: { nombre: archivo.name, base64 } };
    } catch {
      return {
        ok: false,
        error: esPdf
          ? 'No se pudo leer el PDF. Verifica que sea la lista de mesas y no una imagen escaneada.'
          : 'No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) válido.',
      };
    }
  }

  private async celdasDeExcel(archivo: File): Promise<unknown[]> {
    const hojas = await leerXlsx(archivo);
    const filas = hojas[0]?.data ?? [];
    return filas.map((fila) => fila.find((c) => c !== null && c !== undefined && c !== '') ?? null);
  }

  /** pdf.js se carga solo al elegir un PDF: pesa mucho y no corre en el servidor (SSR). */
  private async celdasDePdf(archivo: File): Promise<string[]> {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `${document.baseURI}pdfjs/pdf.worker.min.mjs`;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise;
    const paginas: ItemPdf[][] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGINAS_PDF); n++) {
      const contenido = await (await doc.getPage(n)).getTextContent();
      paginas.push(
        contenido.items
          .filter((i): i is TextItem => 'str' in i)
          .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] }))
      );
    }
    return celdasDesdePaginasPdf(paginas);
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

  /** Devuelve el archivo guardado (Excel o PDF) como descargable, exactamente como se subió. */
  descargar(archivo: InvitadosArchivo): void {
    const binario = atob(archivo.base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    const esPdf = archivo.nombre.toLowerCase().endsWith('.pdf');
    const blob = new Blob([bytes], {
      type: esPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = archivo.nombre || (esPdf ? 'invitados.pdf' : 'invitados.xlsx');
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
