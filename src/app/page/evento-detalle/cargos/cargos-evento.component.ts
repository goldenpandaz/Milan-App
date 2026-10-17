import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import { EventoDetalleService } from '../../../core/services/evento-detalle.service';
import { CargoEvento, MiembroEquipo, TareaEvento } from '../../../core/models/dominio.models';
import { nombreRepetido, normalizarNombre } from '../../../core/logica/catalogo';
import { NOMBRE_CARGO_JEFE, cargoDeTitular } from '../../../core/logica/cargos-evento';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-cargos-evento',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, ModalComponent],
  templateUrl: './cargos-evento.component.html',
})
export class CargosEventoComponent implements OnInit {
  @Input({ required: true }) eventoId = '';
  @Input() editable = false;

  cargos: CargoEvento[] = [];
  equipo: MiembroEquipo[] = [];
  cargando = true;
  error = '';

  nuevaTarea: Record<string, string> = {};

  modalCargo = false;
  editando: CargoEvento | null = null;
  nombre = '';
  manejaInvitados = false;
  cargoAEliminar: CargoEvento | null = null;

  cargoTitular: CargoEvento | null = null;
  /** '' representa "Sin responsable" en el select. */
  titularElegido = '';

  moviendo: { cargo: CargoEvento; tarea: TareaEvento } | null = null;
  destinoId = '';

  constructor(private detalle: EventoDetalleService, private users: UserService, private auth: AuthService) {}

  get uid(): string {
    return this.auth.getSession()?.localId ?? '';
  }

  ngOnInit(): void {
    this.cargar(true);
  }

  get nombreRepetido(): boolean {
    return !!this.nombre.trim() && nombreRepetido(this.nombre, this.cargos, this.editando?.id);
  }

  get puedeGuardar(): boolean {
    return !!this.nombre.trim() && !this.nombreRepetido;
  }

  /** Aviso previo a escribir: la persona elegida ya es titular de otro cargo del evento. */
  get conflictoTitular(): CargoEvento | null {
    if (!this.cargoTitular || !this.titularElegido) return null;
    return cargoDeTitular(this.cargos, this.titularElegido, this.cargoTitular.id);
  }

  get destinosPosibles(): CargoEvento[] {
    return this.cargos.filter((c) => c.id !== this.moviendo?.cargo.id);
  }

  /** El cargo del jefe queda fijo a él: solo se le gestionan las tareas, no el cargo ni el responsable. */
  esCargoJefe(cargo: CargoEvento): boolean {
    return normalizarNombre(cargo.nombre) === NOMBRE_CARGO_JEFE;
  }

  nombreMiembro(id: string | null): string {
    return this.equipo.find((m) => m.id === id)?.nombre ?? 'Persona fuera del equipo';
  }

  /** Solo quien puede editar dispara la copia inicial del catálogo; el trabajador solo lee. */
  cargar(conCopia = false): void {
    this.cargando = true;
    const cargos$ = conCopia && this.editable
      ? this.detalle.asegurarCopiaCatalogo(this.eventoId)
      : this.detalle.listarCargos(this.eventoId);
    forkJoin({ cargos: cargos$, equipo: this.detalle.listarEquipo(this.eventoId) }).subscribe({
      next: ({ cargos, equipo }) => {
        this.cargos = cargos;
        this.equipo = equipo;
        this.cargando = false;
        this.asegurarJefeEnEquipo(equipo);
      },
      error: () => this.fallar('No se pudieron cargar los cargos del evento.'),
    });
  }

  /** El jefe de meseros gestiona todo evento: se suma solo al equipo si todavía no está. */
  private asegurarJefeEnEquipo(equipo: MiembroEquipo[]): void {
    if (!this.editable) return;
    this.users.listarEquipo().subscribe((usuarios) => {
      const jefe = usuarios.find((u) => u.estado === 'activo' && u.rol === 'jefe_mesero');
      if (!jefe || equipo.some((m) => m.id === jefe.uid)) return;
      this.detalle.agregarAlEquipo(this.eventoId, jefe.uid, jefe.nombre, this.uid).subscribe({
        next: () => this.cargar(),
        error: () => {},
      });
    });
  }

  abrirNuevo(): void {
    this.editando = null;
    this.nombre = '';
    this.manejaInvitados = false;
    this.modalCargo = true;
  }

  abrirEditar(cargo: CargoEvento): void {
    this.editando = cargo;
    this.nombre = cargo.nombre;
    this.manejaInvitados = cargo.manejaInvitados;
    this.modalCargo = true;
  }

  guardarCargo(): void {
    if (!this.puedeGuardar) return;
    const datos = { nombre: this.nombre, manejaInvitados: this.manejaInvitados };
    const accion$ = this.editando
      ? this.detalle.actualizarCargo(this.eventoId, this.editando.id, datos)
      : this.detalle.crearCargo(this.eventoId, datos, this.cargos);
    this.ejecutar(accion$, 'No se pudo guardar el cargo.', () => (this.modalCargo = false));
  }

  eliminarCargo(): void {
    if (!this.cargoAEliminar) return;
    this.ejecutar(this.detalle.eliminarCargo(this.eventoId, this.cargoAEliminar.id), 'No se pudo eliminar el cargo.', () => (this.cargoAEliminar = null));
  }

  abrirTitular(cargo: CargoEvento): void {
    this.cargoTitular = cargo;
    this.titularElegido = cargo.titularId ?? '';
  }

  guardarTitular(): void {
    if (!this.cargoTitular || this.conflictoTitular) return;
    const accion$ = this.detalle.asignarTitular(this.eventoId, this.cargoTitular.id, this.titularElegido || null);
    this.ejecutar(accion$, 'No se pudo asignar el responsable.', () => (this.cargoTitular = null));
  }

  agregarTarea(cargo: CargoEvento): void {
    const titulo = (this.nuevaTarea[cargo.id] ?? '').trim();
    if (!titulo) return;
    this.ejecutar(this.detalle.crearTarea(this.eventoId, cargo, titulo), 'No se pudo agregar la tarea.', () => (this.nuevaTarea[cargo.id] = ''));
  }

  eliminarTarea(cargo: CargoEvento, tareaId: string): void {
    this.ejecutar(this.detalle.eliminarTarea(this.eventoId, cargo.id, tareaId), 'No se pudo eliminar la tarea.');
  }

  abrirMover(cargo: CargoEvento, tarea: TareaEvento): void {
    this.moviendo = { cargo, tarea };
    this.destinoId = '';
  }

  moverTarea(): void {
    if (!this.moviendo || !this.destinoId) return;
    const { cargo, tarea } = this.moviendo;
    this.ejecutar(this.detalle.moverTarea(this.eventoId, cargo, tarea.id, this.destinoId), 'No se pudo mover la tarea.', () => (this.moviendo = null));
  }

  private ejecutar(accion$: Observable<unknown>, mensajeError: string, alTerminar?: () => void): void {
    accion$.subscribe({
      next: () => {
        alTerminar?.();
        this.cargar();
      },
      error: () => this.fallar(mensajeError),
    });
  }

  private fallar(mensaje: string): void {
    this.error = mensaje;
    this.cargando = false;
  }
}
