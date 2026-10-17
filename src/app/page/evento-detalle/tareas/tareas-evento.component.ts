import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { EventoDetalleService } from '../../../core/services/evento-detalle.service';
import { AuthService } from '../../../core/services/auth.service';
import { CargoEvento, MiembroEquipo } from '../../../core/models/dominio.models';

/**
 * Admin y jefe ven el avance de TODOS los cargos (solo lectura); un trabajador ve, y marca,
 * solo las tareas del cargo del que es titular.
 */
@Component({
  selector: 'app-tareas-evento',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tareas-evento.component.html',
})
export class TareasEventoComponent implements OnInit {
  @Input({ required: true }) eventoId = '';
  @Input() puedeGestionar = false;

  cargos: CargoEvento[] = [];
  equipo: MiembroEquipo[] = [];
  cargando = true;
  error = '';
  enCurso = new Set<string>();

  constructor(private detalle: EventoDetalleService, private auth: AuthService) {}

  get uid(): string {
    return this.auth.getSession()?.localId ?? '';
  }

  ngOnInit(): void {
    this.cargar();
  }

  /** Solo el titular marca las tareas de su cargo; admin y jefe ven las ajenas en solo lectura. */
  esMia(cargo: CargoEvento): boolean {
    return cargo.titularId === this.uid;
  }

  hechas(cargo: CargoEvento): number {
    return cargo.tareas.filter((t) => t.estado === 'hecho').length;
  }

  nombreMiembro(id: string | null): string {
    return this.equipo.find((m) => m.id === id)?.nombre ?? 'Sin responsable';
  }

  cargar(): void {
    this.cargando = true;
    forkJoin({ cargos: this.detalle.listarCargos(this.eventoId), equipo: this.detalle.listarEquipo(this.eventoId) }).subscribe({
      next: ({ cargos, equipo }) => {
        this.equipo = equipo;
        this.cargos = this.puedeGestionar ? cargos : cargos.filter((c) => c.titularId === this.uid);
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar las tareas.';
        this.cargando = false;
      },
    });
  }

  alternar(cargo: CargoEvento, tareaId: string, hecho: boolean): void {
    if (this.enCurso.has(tareaId)) return;
    this.enCurso.add(tareaId);
    this.detalle.marcarTarea(this.eventoId, cargo.id, tareaId, hecho, this.uid).subscribe({
      next: () => {
        this.enCurso.delete(tareaId);
        this.cargar();
      },
      error: () => {
        this.enCurso.delete(tareaId);
        this.error = 'No se pudo guardar la tarea. Intenta de nuevo.';
      },
    });
  }
}
