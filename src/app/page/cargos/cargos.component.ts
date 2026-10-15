import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogoService } from '../../core/services/catalogo.service';
import { AuthService } from '../../core/services/auth.service';
import { CargoCatalogo } from '../../core/models/dominio.models';
import { nombreRepetido } from '../../core/logica/catalogo';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-cargos',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, ModalComponent],
  templateUrl: './cargos.component.html',
})
export default class CargosComponent implements OnInit {
  cargos: CargoCatalogo[] = [];
  cargando = true;
  error = '';

  nuevaTarea: Record<string, string> = {};
  /** `"{cargoId}:{tareaId}"` de la tarea que se está editando, o null si ninguna. */
  tareaEditando: string | null = null;
  tituloEditado = '';

  modalAbierto = false;
  /** Cargo que se está editando; null cuando el modal es para crear uno nuevo. */
  editando: CargoCatalogo | null = null;
  nombre = '';
  manejaInvitados = false;
  cargoAEliminar: CargoCatalogo | null = null;

  constructor(private catalogo: CatalogoService, private auth: AuthService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get uid(): string {
    return this.auth.getSession()?.localId ?? '';
  }

  get nombreRepetido(): boolean {
    return !!this.nombre.trim() && nombreRepetido(this.nombre, this.cargos, this.editando?.id);
  }

  get puedeGuardar(): boolean {
    return !!this.nombre.trim() && !this.nombreRepetido;
  }

  cargar(): void {
    this.cargando = true;
    this.catalogo.listar().subscribe({
      next: (cargos) => {
        this.cargos = cargos;
        this.cargando = false;
      },
      error: () => this.fallar('No se pudo cargar el catálogo.'),
    });
  }

  abrirNuevo(): void {
    this.editando = null;
    this.nombre = '';
    this.manejaInvitados = false;
    this.modalAbierto = true;
  }

  abrirEditar(cargo: CargoCatalogo): void {
    this.editando = cargo;
    this.nombre = cargo.nombre;
    this.manejaInvitados = cargo.manejaInvitados;
    this.modalAbierto = true;
  }

  guardarCargo(): void {
    if (!this.puedeGuardar) return;
    const datos = { nombre: this.nombre, manejaInvitados: this.manejaInvitados };
    const accion$ = this.editando
      ? this.catalogo.actualizarCargo(this.editando.id, datos, this.uid)
      : this.catalogo.crearCargo(datos, this.cargos, this.uid);

    accion$.subscribe({
      next: () => {
        this.modalAbierto = false;
        this.cargar();
      },
      error: () => this.fallar('No se pudo guardar el cargo.'),
    });
  }

  eliminarCargo(): void {
    if (!this.cargoAEliminar) return;
    this.catalogo.eliminarCargo(this.cargoAEliminar.id).subscribe({
      next: () => {
        this.cargoAEliminar = null;
        this.cargar();
      },
      error: () => this.fallar('No se pudo eliminar el cargo.'),
    });
  }

  agregarTarea(cargo: CargoCatalogo): void {
    const titulo = (this.nuevaTarea[cargo.id] ?? '').trim();
    if (!titulo) return;
    this.catalogo.crearTarea(cargo, titulo, this.uid).subscribe({
      next: () => {
        this.nuevaTarea[cargo.id] = '';
        this.cargar();
      },
      error: () => this.fallar('No se pudo agregar la tarea.'),
    });
  }

  eliminarTarea(cargo: CargoCatalogo, tareaId: string): void {
    this.catalogo.eliminarTarea(cargo.id, tareaId, this.uid).subscribe({
      next: () => this.cargar(),
      error: () => this.fallar('No se pudo eliminar la tarea.'),
    });
  }

  editarTarea(cargo: CargoCatalogo, tareaId: string, tituloActual: string): void {
    this.tareaEditando = `${cargo.id}:${tareaId}`;
    this.tituloEditado = tituloActual;
  }

  cancelarEdicionTarea(): void {
    this.tareaEditando = null;
  }

  guardarTarea(cargo: CargoCatalogo, tareaId: string): void {
    const titulo = this.tituloEditado.trim();
    this.tareaEditando = null;
    if (!titulo) return;
    this.catalogo.renombrarTarea(cargo.id, tareaId, titulo, this.uid).subscribe({
      next: () => this.cargar(),
      error: () => this.fallar('No se pudo guardar la tarea.'),
    });
  }

  private fallar(mensaje: string): void {
    this.error = mensaje;
    this.cargando = false;
  }
}
