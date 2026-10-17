import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EventService } from '../../core/services/event.service';
import { AuthService } from '../../core/services/auth.service';
import { Evento } from '../../core/models/dominio.models';
import { EquipoEventoComponent } from './equipo/equipo-evento.component';
import { CargosEventoComponent } from './cargos/cargos-evento.component';
import { InvitadosEventoComponent } from './invitados/invitados-evento.component';
import { TareasEventoComponent } from './tareas/tareas-evento.component';
import { EventoDetalleService } from '../../core/services/evento-detalle.service';

type Seccion = 'equipo' | 'cargos' | 'invitados' | 'tareas';

@Component({
  selector: 'app-evento-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink, EquipoEventoComponent, CargosEventoComponent, InvitadosEventoComponent, TareasEventoComponent],
  templateUrl: './evento-detalle.component.html',
})
export default class EventoDetalleComponent implements OnInit {
  eventoId = '';
  evento: Evento | null = null;
  error = '';
  seccion: Seccion = 'tareas';
  cargoInvitadosId: string | null = null;
  /** Evita mostrar "sin acceso" mientras todavía se están leyendo los cargos. */
  cargosListo = true;

  constructor(
    private route: ActivatedRoute,
    private eventService: EventService,
    private auth: AuthService,
    private detalle: EventoDetalleService
  ) {}

  get puedeGestionar(): boolean {
    const rol = this.auth.getSession()?.rol;
    return rol === 'administrador' || rol === 'jefe_mesero';
  }

  /** Admin y jefe suben o re-suben la lista de invitados, en cualquier estado del evento. */
  get puedeSubirInvitados(): boolean {
    return this.puedeGestionar;
  }

  /** Admin y jefe siempre; un trabajador, si es titular de un cargo con lista de invitados. */
  get puedeMarcarInvitados(): boolean {
    return this.puedeGestionar || !!this.cargoInvitadosId;
  }

  /** El trabajador ve sus tareas e Invitados (con aviso si no tiene acceso); equipo y cargos son de gestión. */
  get secciones(): { id: Seccion; texto: string }[] {
    const todas: { id: Seccion; texto: string }[] = [
      { id: 'equipo', texto: 'Equipo' },
      { id: 'cargos', texto: 'Cargos' },
      { id: 'invitados', texto: 'Invitados' },
      { id: 'tareas', texto: 'Tareas' },
    ];
    return this.puedeGestionar ? todas : todas.filter((s) => s.id === 'tareas' || s.id === 'invitados');
  }

  ngOnInit(): void {
    this.eventoId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.puedeGestionar) this.seccion = 'equipo';
    else this.buscarCargoInvitados();
    this.eventService.obtener(this.eventoId).subscribe({
      next: (evento) => (this.evento = evento?.nombre ? evento : null),
      error: () => (this.error = 'No se pudo cargar el evento.'),
    });
  }

  /** Cargo con `manejaInvitados` del que el trabajador es titular (las reglas lo vuelven a comprobar al marcar). */
  private buscarCargoInvitados(): void {
    const uid = this.auth.getSession()?.localId;
    if (!uid) return;
    this.cargosListo = false;
    this.detalle.listarCargos(this.eventoId).subscribe({
      next: (cargos) => {
        this.cargoInvitadosId = cargos.find((c) => c.manejaInvitados && c.titularId === uid)?.id ?? null;
        this.cargosListo = true;
      },
      error: () => (this.cargosListo = true),
    });
  }
}
