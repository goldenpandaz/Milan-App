import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { EventoDetalleService } from '../../../core/services/evento-detalle.service';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { CargoEvento, MiembroEquipo, Usuario } from '../../../core/models/dominio.models';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-equipo-evento',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, ModalComponent],
  templateUrl: './equipo-evento.component.html',
})
export class EquipoEventoComponent implements OnInit {
  @Input({ required: true }) eventoId = '';
  @Input() editable = false;

  usuarios: Usuario[] = [];
  equipo: MiembroEquipo[] = [];
  cargos: CargoEvento[] = [];
  cargando = true;
  error = '';

  modalAbierto = false;
  nombreNoRegistrado = '';

  constructor(private detalle: EventoDetalleService, private users: UserService, private auth: AuthService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get uid(): string {
    return this.auth.getSession()?.localId ?? '';
  }

  get noRegistrados(): MiembroEquipo[] {
    return this.equipo.filter((m) => m.noRegistrado);
  }

  /** El jefe de meseros gestiona todo evento: se suma solo, no se elige a mano ni se puede sacar. */
  get jefe(): Usuario | null {
    return this.usuarios.find((u) => u.rol === 'jefe_mesero') ?? null;
  }

  get trabajadores(): Usuario[] {
    return this.usuarios.filter((u) => u.rol !== 'jefe_mesero');
  }

  enEquipo(uid: string): boolean {
    return this.equipo.some((m) => m.id === uid);
  }

  cargar(): void {
    this.cargando = true;
    forkJoin({
      usuarios: this.users.listarEquipo(),
      equipo: this.detalle.listarEquipo(this.eventoId),
      cargos: this.detalle.listarCargos(this.eventoId),
    }).subscribe({
      next: ({ usuarios, equipo, cargos }) => {
        this.usuarios = usuarios
          .filter((u) => u.estado === 'activo' && u.rol !== 'administrador')
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.equipo = equipo;
        this.cargos = cargos;
        this.cargando = false;
        this.asegurarJefeEnEquipo();
      },
      error: () => this.fallar('No se pudo cargar el equipo.'),
    });
  }

  /** Si el jefe de meseros todavía no está en este evento, se suma solo (sin pedir confirmación). */
  private asegurarJefeEnEquipo(): void {
    if (!this.editable || !this.jefe || this.enEquipo(this.jefe.uid)) return;
    this.detalle.agregarAlEquipo(this.eventoId, this.jefe.uid, this.jefe.nombre, this.uid).subscribe({
      next: () => this.cargar(),
      error: () => {}, // si falla, se reintenta en la próxima carga; no es un error que deba ver el usuario
    });
  }

  alternar(usuario: Usuario): void {
    if (!this.editable) return;
    const accion$ = this.enEquipo(usuario.uid)
      ? this.detalle.quitarDelEquipo(this.eventoId, usuario.uid, this.cargos)
      : this.detalle.agregarAlEquipo(this.eventoId, usuario.uid, usuario.nombre, this.uid);
    accion$.subscribe({ next: () => this.cargar(), error: () => this.fallar('No se pudo actualizar el equipo.') });
  }

  quitar(miembro: MiembroEquipo): void {
    this.detalle.quitarDelEquipo(this.eventoId, miembro.id, this.cargos).subscribe({
      next: () => this.cargar(),
      error: () => this.fallar('No se pudo quitar a la persona.'),
    });
  }

  abrirNoRegistrado(): void {
    this.nombreNoRegistrado = '';
    this.modalAbierto = true;
  }

  guardarNoRegistrado(): void {
    if (!this.nombreNoRegistrado.trim()) return;
    this.detalle.agregarNoRegistrado(this.eventoId, this.nombreNoRegistrado, this.uid).subscribe({
      next: () => {
        this.modalAbierto = false;
        this.cargar();
      },
      error: () => this.fallar('No se pudo agregar a la persona.'),
    });
  }

  private fallar(mensaje: string): void {
    this.error = mensaje;
    this.cargando = false;
  }
}
