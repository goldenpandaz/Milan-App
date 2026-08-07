export type Rol = 'administrador' | 'jefe_mesero' | 'mesero';

export type EstadoUsuario = 'pendiente' | 'activo';

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
