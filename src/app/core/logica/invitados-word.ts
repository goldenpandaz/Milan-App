/**
 * Convierte el texto plano de un Word (un párrafo o celda por línea) en la misma lista de celdas que produce el Excel:
 * título de mesa seguido de sus invitados. Ignora los números de fila ("1", "2." o "3)") y quita el número
 * que antecede al nombre ("1 HARRY"). Un título partido en dos líneas ("Mesa" / "2") se une.
 */
export function celdasDesdeTextoWord(texto: string): string[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  const celdas: string[] = [];
  for (let k = 0; k < lineas.length; k++) {
    let linea = lineas[k];
    if (/^\d{1,3}[.)]?$/.test(linea)) continue;
    if (/^mesa\b/i.test(linea)) {
      while (/^mesa$/i.test(linea) && /^\d{1,3}$|^principal$/i.test(lineas[k + 1] ?? '')) {
        linea = `${linea} ${lineas[++k]}`;
      }
      celdas.push(linea);
      continue;
    }
    celdas.push(linea.replace(/^\d{1,3}[.)]?\s+/, ''));
  }
  return celdas;
}
