/** Fragmento de texto de una página PDF con su posición (origen abajo a la izquierda, como en PDF). */
export interface ItemPdf {
  str: string;
  x: number;
  y: number;
}

const TOL = 3;
const MARGEN_BANDA = 55;
const ALTO_MAX_ENVUELTO = 40;

const esNumero = (s: string) => /^\d{1,2}$/.test(s);

function tituloMesa(textos: string[]): string | null {
  const unido = textos.join(' ').replace(/\s+/g, ' ').trim();
  if (!unido) return null;
  if (/principal/i.test(unido)) return 'MESA PRINCIPAL';
  const numero = /mesa(\d+)/i.exec(unido.replace(/\s+/g, ''));
  return numero ? `MESA ${numero[1]}` : `MESA ${unido.toUpperCase()}`;
}

function enOrdenDeLectura(a: ItemPdf, b: ItemPdf): number {
  return Math.abs(a.y - b.y) < TOL ? a.x - b.x : b.y - a.y;
}

/**
 * Convierte las páginas de un PDF con tablas de mesas lado a lado ("n NOMBRE" por fila, título arriba)
 * en la misma lista de celdas que produce el Excel: título de mesa seguido de sus invitados.
 * Cada tabla se ubica por su fila "1" (los títulos y los nombres pueden partirse en varias líneas).
 */
export function celdasDesdePaginasPdf(paginas: ItemPdf[][]): string[] {
  const celdas: string[] = [];

  for (const pagina of paginas) {
    const items = pagina.map((i) => ({ ...i, str: i.str.trim() })).filter((i) => i.str);

    const anclas: ItemPdf[] = [];
    for (const uno of items.filter((i) => i.str === '1').sort((a, b) => a.x - b.x)) {
      const cercana = anclas.findIndex((a) => Math.abs(a.x - uno.x) < 70);
      if (cercana === -1) anclas.push(uno);
      else if (uno.y < anclas[cercana].y) anclas[cercana] = uno;
    }
    anclas.sort((a, b) => a.x - b.x);

    anclas.forEach((ancla, k) => {
      const desde = k === 0 ? -Infinity : ancla.x - MARGEN_BANDA;
      const hasta = k === anclas.length - 1 ? Infinity : anclas[k + 1].x - MARGEN_BANDA;
      const banda = items.filter((i) => i.x >= desde && i.x < hasta);
      const y1 = ancla.y;

      const debajo = banda.filter((i) => i.y <= y1 + TOL && !esNumero(i.str));
      if (debajo.length === 0) return;
      const xNombre = Math.min(...debajo.map((i) => i.x)) - TOL;

      const numeros = banda
        .filter((i) => esNumero(i.str) && i.x < xNombre && i.y <= y1 + TOL)
        .sort((a, b) => b.y - a.y);
      const filas: ItemPdf[][] = numeros.map(() => []);

      for (const item of banda) {
        if (item.x < xNombre || item.y > y1 + ALTO_MAX_ENVUELTO) continue;
        let fila = numeros.findIndex((n) => n.y <= item.y + TOL);
        if (fila === -1) fila = numeros.length - 1;
        filas[fila].push(item);
      }

      const titulo = tituloMesa(
        banda
          .filter((i) => i.x < xNombre && i.y > y1 + TOL)
          .sort(enOrdenDeLectura)
          .map((i) => i.str)
      );
      if (titulo) celdas.push(titulo);

      for (const fila of filas) {
        const nombre = fila
          .sort(enOrdenDeLectura)
          .map((i) => i.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (nombre) celdas.push(nombre);
      }
    });
  }

  return celdas;
}
