import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EventService } from '../../core/services/event.service';
import { AuthService } from '../../core/services/auth.service';
import { Evento } from '../../core/models/dominio.models';
import { BadgeComponent, TonoBadge } from '../../shared/components/badge/badge.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-eventos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BadgeComponent, ModalComponent],
  templateUrl: './eventos.component.html',
})
export default class EventosComponent implements OnInit {
  eventos: Evento[] = [];
  cargando = true;
  modalAbierto = false;
  /** Evento que se está editando; null cuando el modal es para crear uno nuevo. */
  editando: Evento | null = null;
  eventoAEliminar: Evento | null = null;
  form: FormGroup;

  constructor(
    private eventService: EventService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      fecha: ['', Validators.required],
      horaInicio: ['19:00', Validators.required],
      horaFin: ['03:00', Validators.required],
      personas: [null, [Validators.required, Validators.min(1)]],
    });
  }

  ngOnInit(): void {
    this.cargar();
  }

  /** Administrador y jefe de meseros crean, editan y finalizan eventos. */
  get puedeCrear(): boolean {
    const rol = this.authService.getSession()?.rol;
    return rol === 'administrador' || rol === 'jefe_mesero';
  }

  /** Solo el administrador elimina eventos. */
  get puedeEliminar(): boolean {
    return this.authService.getSession()?.rol === 'administrador';
  }

  get uid(): string {
    return this.authService.getSession()?.localId ?? '';
  }

  cargar(): void {
    this.cargando = true;
    this.eventService.listar().subscribe((eventos) => {
      this.eventos = eventos;
      this.cargando = false;
    });
  }

  finalizar(evento: Evento): void {
    this.eventService.finalizar(evento.id).subscribe(() => this.cargar());
  }

  reactivar(evento: Evento): void {
    this.eventService.reactivar(evento.id).subscribe(() => this.cargar());
  }

  badgeEstado(estado: Evento['estado']): { texto: string; tono: TonoBadge } {
    switch (estado) {
      case 'programado':
        return { texto: 'Programado', tono: 'neutro' };
      case 'en_curso':
        return { texto: 'En curso', tono: 'plata' };
      case 'finalizado':
        return { texto: 'Finalizado', tono: 'ok' };
      default:
        return { texto: '—', tono: 'neutro' };
    }
  }

  abrirNuevo(): void {
    this.editando = null;
    this.form.reset({ horaInicio: '19:00', horaFin: '03:00', personas: null });
    this.modalAbierto = true;
  }

  abrirEditar(evento: Evento): void {
    this.editando = evento;
    this.form.reset({
      nombre: evento.nombre,
      fecha: evento.fecha,
      horaInicio: evento.horaInicio,
      horaFin: evento.horaFin,
      personas: evento.personas ?? null,
    });
    this.modalAbierto = true;
  }

  guardar(): void {
    if (this.form.invalid) return;
    const accion$ = this.editando
      ? this.eventService.actualizar(this.editando.id, this.form.value)
      : this.eventService.crear(this.form.value, this.uid);

    accion$.subscribe(() => {
      this.modalAbierto = false;
      this.editando = null;
      this.cargar();
    });
  }

  eliminar(): void {
    if (!this.eventoAEliminar) return;
    this.eventService.eliminar(this.eventoAEliminar.id).subscribe(() => {
      this.eventoAEliminar = null;
      this.cargar();
    });
  }
}
