import { Rol } from '../core/models/dominio.models';

export interface ItemNav {
  etiqueta: string;
  ruta: string;
  icono: string; // path SVG
}

const ICONO_EVENTOS = 'M3 10h18M7 3v4M17 3v4M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z';
const ICONO_EQUIPO = 'M17 20h5v-1a4 4 0 00-4-4h-1M9 20H4v-1a4 4 0 014-4h1m0-4a3 3 0 100-6 3 3 0 000 6zm7 0a3 3 0 100-6 3 3 0 000 6z';
const ICONO_TAREAS = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4';

export const NAV_POR_ROL: Record<Rol, ItemNav[]> = {
  administrador: [
    { etiqueta: 'Eventos', ruta: '/app/eventos', icono: ICONO_EVENTOS },
    { etiqueta: 'Cargos', ruta: '/app/cargos', icono: ICONO_TAREAS },
    { etiqueta: 'Equipo', ruta: '/app/admin/equipo', icono: ICONO_EQUIPO },
  ],
  jefe_mesero: [
    { etiqueta: 'Eventos', ruta: '/app/eventos', icono: ICONO_EVENTOS },
    { etiqueta: 'Cargos', ruta: '/app/cargos', icono: ICONO_TAREAS },
  ],
  mesero: [
    { etiqueta: 'Eventos', ruta: '/app/eventos', icono: ICONO_EVENTOS },
    { etiqueta: 'Mis tareas', ruta: '/app/tareas', icono: ICONO_TAREAS },
  ],
};
