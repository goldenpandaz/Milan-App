import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogoService } from '../../core/services/catalogo.service';
import { AuthService } from '../../core/services/auth.service';
import { CargoCatalogo, TipoCargo } from '../../core/models/dominio.models';
import { puedeAgregarDesmontaje } from '../../core/logica/catalogo';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import {
  OpcionSegmentada,
  SegmentedControlComponent,
} from '../../shared/components/segmented-control/segmented-control.component';

const ETIQUETA_TIPO: Record<TipoCargo, string> = {
  mesero: 'Mesero',
  portero: 'Portero',
  desmontaje: 'Desmontaje',
  libre: 'Otro',
};

@Component({
  selector: 'app-cargos',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, ModalComponent, SegmentedControlComponent],
  templateUrl: './cargos.component.html',
})
export default class CargosComponent implements OnInit {
  cargos: CargoCatalogo[] = [];
  cargando = true;
  error = '';

  /** Cargo desplegado (acordeón): solo uno a la vez para que la lista siga siendo corta en el celular. */
  abiertoId: string | null = null;
  nuevaTarea: Record<string, string> = {};

  modalAbierto = false;
  /** Cargo que se está renombrando; null cuando el modal es para crear uno nuevo. */
  editando: CargoCatalogo | null = null;
  tipoNuevo: TipoCargo = 'mesero';
  nombreNuevo = '';
  cargoAEliminar: CargoCatalogo | null = null;

  constructor(private catalogo: CatalogoService, private auth: AuthService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get uid(): string {
    return this.auth.getSession()?.localId ?? '';
  }

  get opcionesTipo(): OpcionSegmentada[] {
    const tipos: TipoCargo[] = ['mesero', 'portero', 'libre'];
    if (puedeAgregarDesmontaje(this.cargos)) tipos.splice(2, 0, 'desmontaje');
    return tipos.map((valor) => ({ valor, etiqueta: ETIQUETA_TIPO[valor] }));
  }

  get nombreObligatorio(): boolean {
    return this.tipoNuevo === 'libre';
  }

  get puedeGuardar(): boolean {
    return !this.nombreObligatorio || !!this.nombreNuevo.trim() || !!this.editando;
  }

  etiquetaTipo(tipo: TipoCargo): string {
    return ETIQUETA_TIPO[tipo];
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

  alternar(cargo: CargoCatalogo): void {
    this.abiertoId = this.abiertoId === cargo.id ? null : cargo.id;
  }

  abrirNuevo(): void {
    this.editando = null;
    this.tipoNuevo = 'mesero';
    this.nombreNuevo = '';
    this.modalAbierto = true;
  }

  abrirRenombrar(cargo: CargoCatalogo): void {
    this.editando = cargo;
    this.nombreNuevo = cargo.nombre;
    this.modalAbierto = true;
  }

  elegirTipo(tipo: string): void {
    this.tipoNuevo = tipo as TipoCargo;
  }

  guardarCargo(): void {
    if (!this.puedeGuardar) return;
    const accion$ = this.editando
      ? this.catalogo.renombrarCargo(this.editando.id, this.nombreNuevo, this.uid)
      : this.catalogo.crearCargo(this.tipoNuevo, this.nombreNuevo, this.cargos, this.uid);

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
        this.abiertoId = null;
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

  private fallar(mensaje: string): void {
    this.error = mensaje;
    this.cargando = false;
  }
}
