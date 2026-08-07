import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EventService } from '../../core/services/event.service';
import { AuthService } from '../../core/services/auth.service';
import { Evento, Participante } from '../../core/models/dominio.models';
import { BadgeComponent, TonoBadge } from '../../shared/components/badge/badge.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-eventos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BadgeComponent, ModalComponent],
  templateUrl: './eventos.component.html',
})
export default class EventosComponent implements OnInit {
  eventos: Evento[] = [];
  participantesPorEvento: Record<string, Participante[]> = {};
  cargando = true;
  modalAbierto = false;
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
    });
  }

  ngOnInit(): void {
    this.cargar();
  }

  get puedeCrear(): boolean {
    const rol = this.authService.getSession()?.rol;
    return rol === 'administrador' || rol === 'jefe_mesero';
  }

  get uid(): string {
    return this.authService.getSession()?.localId ?? '';
  }

  cargar(): void {
    this.cargando = true;
    this.eventService.listar().subscribe((eventos) => {
      this.eventos = eventos;
      this.cargando = false;
      eventos.forEach((e) => this.cargarParticipantes(e.id));
    });
  }

  cargarParticipantes(eventoId: string): void {
    this.eventService.listarParticipantes(eventoId).subscribe((p) => {
      this.participantesPorEvento[eventoId] = p;
    });
  }

  estoyActivo(eventoId: string): boolean {
    const p = this.participantesPorEvento[eventoId]?.find((x) => x.uid === this.uid);
    return !!p?.activo;
  }

  activosEnEvento(eventoId: string): number {
    return this.participantesPorEvento[eventoId]?.filter((p) => p.activo).length ?? 0;
  }

  toggleActivacion(evento: Evento): void {
    const nombre = this.authService.getSession()?.nombre ?? '';
    const accion$ = this.estoyActivo(evento.id)
      ? this.eventService.desactivarme(evento.id, this.uid)
      : this.eventService.activarme(evento.id, this.uid, nombre);

    accion$.subscribe(() => this.cargarParticipantes(evento.id));
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

  crear(): void {
    if (this.form.invalid) return;
    this.eventService.crear(this.form.value, this.uid).subscribe(() => {
      this.modalAbierto = false;
      this.form.reset({ horaInicio: '19:00', horaFin: '03:00' });
      this.cargar();
    });
  }
}
