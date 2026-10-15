/** Id corto y ordenable por tiempo, generado en el cliente (RTDB no necesita que lo emita el servidor). */
export function generarId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
