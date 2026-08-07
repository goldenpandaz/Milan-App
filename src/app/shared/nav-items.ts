import { Rol } from '../core/models/dominio.models';

export interface ItemNav {
  etiqueta: string;
  ruta: string;
  icono: string; // path SVG
}

const ICONO_EVENTOS = 'M3 10h18M7 3v4M17 3v4M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z';
const ICONO_EQUIPO = 'M17 20h5v-1a4 4 0 00-4-4h-1M9 20H4v-1a4 4 0 014-4h1m0-4a3 3 0 100-6 3 3 0 000 6zm7 0a3 3 0 100-6 3 3 0 000 6z';
const ICONO_SOLICITUDES = 'M12 4v16m8-8H4';
const ICONO_TAREAS = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4';
const ICONO_ASIGNAR = 'M4 17h10m0 0l-3-3m3 3l-3 3M20 7H10m0 0l3-3m-3 3l3 3';

export const NAV_POR_ROL: Record<Rol, ItemNav[]> = {
  administrador: [
    { etiqueta: 'Eventos', ruta: '/app/eventos', icono: ICONO_EVENTOS },
    { etiqueta: 'Equipo', ruta: '/app/admin/equipo', icono: ICONO_EQUIPO },
    { etiqueta: 'Solicitudes', ruta: '/app/admin/pendientes', icono: ICONO_SOLICITUDES },
    { etiqueta: 'Tareas', ruta: '/app/tareas', icono: ICONO_TAREAS },
    { etiqueta: 'Asignar', ruta: '/app/tareas/asignar', icono: ICONO_ASIGNAR },
  ],
  jefe_mesero: [
    { etiqueta: 'Eventos', ruta: '/app/eventos', icono: ICONO_EVENTOS },
    { etiqueta: 'Tareas', ruta: '/app/tareas', icono: ICONO_TAREAS },
    { etiqueta: 'Asignar', ruta: '/app/tareas/asignar', icono: ICONO_ASIGNAR },
  ],
  mesero: [
    { etiqueta: 'Eventos', ruta: '/app/eventos', icono: ICONO_EVENTOS },
    { etiqueta: 'Mis tareas', ruta: '/app/tareas', icono: ICONO_TAREAS },
  ],
};
