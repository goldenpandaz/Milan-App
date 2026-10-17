export type Rol = 'administrador' | 'jefe_mesero' | 'mesero';

export type EstadoUsuario = 'activo' | 'inactivo';

export interface Usuario {
  uid: string;
  nombre: string;
  email: string;
  rol: Rol | null;
  estado: EstadoUsuario;
  creadoEn: number;
}

export type EstadoEvento = 'programado' | 'en_curso' | 'finalizado';

export interface Evento {
  id: string;
  nombre: string;
  fecha: string; // YYYY-MM-DD
  horaInicio: string; // HH:mm
  horaFin: string; // HH:mm
  /** Cantidad de invitados. Opcional: los eventos creados antes de este campo no lo tienen. */
  personas?: number;
  estado: EstadoEvento;
  /** Denormalizado para que las reglas de seguridad puedan validar sin escanear todas las tareas. */
  desmontajeAsignadoA?: string | null;
  creadoPor: string;
  creadoEn: number;
}

export interface Participante {
  uid: string;
  nombre: string;
  activo: boolean;
  marcadoEn: number;
}

export interface TareaCatalogo {
  id: string;
  titulo: string;
  orden: number;
}

/** Cargo del catálogo general (no depende de ningún evento). */
export interface CargoCatalogo {
  id: string;
  nombre: string;
  orden: number;
  /** Quien lo ocupa en un evento puede abrir la lista de invitados y marcar asistencia. */
  manejaInvitados: boolean;
  actualizadoPor: string;
  actualizadoEn: number;
  tareas: TareaCatalogo[];
}

/** Trabajador sumado a un evento. `id` es el uid real o `nr_{id}` si no está registrado en la app. */
export interface MiembroEquipo {
  id: string;
  nombre: string;
  noRegistrado?: boolean;
  agregadoPor: string;
  agregadoEn: number;
}

export interface TareaEvento {
  id: string;
  titulo: string;
  orden: number;
  estado: EstadoTarea;
  hechoPor?: string | null;
  hechoEn?: number | null;
}

/** Copia local de un cargo dentro de un evento; una vez copiada no depende del catálogo general. */
export interface CargoEvento {
  id: string;
  nombre: string;
  orden: number;
  manejaInvitados: boolean;
  titularId: string | null;
  origenCatalogoId: string | null;
  tareas: TareaEvento[];
}

/** Invitado de la lista del evento (`eventos/{eid}/invitados/{iid}`). */
export interface InvitadoEvento {
  id: string;
  nombre: string;
  /** Sin tildes, minúsculas y espacios colapsados: para buscar y emparejar al re-subir. */
  nombreNormalizado: string;
  mesa: string | null;
  /** Posición en el Excel (por mesa, en el orden en que aparece); así la lista se ve igual que el archivo. */
  orden: number;
  asistio: boolean;
  asistioPor: string | null;
  asistioEn: number | null;
  /** Ya había llegado y la lista nueva no lo trae: se conserva para no perder su asistencia. */
  fueraDeLista?: boolean;
}

/** El .xlsx original tal cual se subió (`eventos/{eid}/invitadosArchivo`), para poder descargarlo igual que se subió. */
export interface InvitadosArchivo {
  nombre: string;
  base64: string;
  subidoPor: string;
  subidoEn: number;
}

export type EstadoTarea = 'pendiente' | 'hecho';

export type TipoTarea = 'general' | 'lavado' | 'montaje' | 'desmontaje';

export interface Tarea {
  id: string;
  titulo: string;
  tipo: TipoTarea;
  asignadoA: string | null;
  estado: EstadoTarea;
  creadoPor: string;
  creadoEn: number;
}

export interface ItemInventario {
  id: string;
  nombre: string;
  cantidad: number;
  falta: boolean;
  nota: string;
  cargadoPor: string;
  cargadoEn: number;
  confirmadoPorAdmin: boolean;
}

export interface Sesion {
  idToken: string;
  refreshToken: string;
  /** Timestamp (ms) en el que vence idToken. Firebase lo emite con 1h de vida. */
  expiraEn: number;
  localId: string; // uid
  email: string;
  nombre: string;
  rol: Rol | null;
  estado: EstadoUsuario | null;
}
