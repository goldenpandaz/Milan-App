import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EventService } from '../../core/services/event.service';
import { AuthService } from '../../core/services/auth.service';
import { Evento } from '../../core/models/dominio.models';
import { EquipoEventoComponent } from './equipo/equipo-evento.component';
import { CargosEventoComponent } from './cargos/cargos-evento.component';

type Seccion = 'equipo' | 'cargos' | 'invitados' | 'tareas';

@Component({
  selector: 'app-evento-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink, EquipoEventoComponent, CargosEventoComponent],
  templateUrl: './evento-detalle.component.html',
})
export default class EventoDetalleComponent implements OnInit {
  eventoId = '';
  evento: Evento | null = null;
  error = '';
  seccion: Seccion = 'tareas';

  constructor(private route: ActivatedRoute, private eventService: EventService, private auth: AuthService) {}

  get puedeGestionar(): boolean {
    const rol = this.auth.getSession()?.rol;
    return rol === 'administrador' || rol === 'jefe_mesero';
  }

  /** El trabajador solo ve sus tareas; equipo, cargos e invitados son de gestión. */
  get secciones(): { id: Seccion; texto: string }[] {
    const todas: { id: Seccion; texto: string }[] = [
      { id: 'equipo', texto: 'Equipo' },
      { id: 'cargos', texto: 'Cargos' },
      { id: 'invitados', texto: 'Invitados' },
      { id: 'tareas', texto: 'Tareas' },
    ];
    return this.puedeGestionar ? todas : todas.filter((s) => s.id === 'tareas');
  }

  ngOnInit(): void {
    this.eventoId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.puedeGestionar) this.seccion = 'equipo';
    this.eventService.obtener(this.eventoId).subscribe({
      next: (evento) => (this.evento = evento?.nombre ? evento : null),
      error: () => (this.error = 'No se pudo cargar el evento.'),
    });
  }
}
