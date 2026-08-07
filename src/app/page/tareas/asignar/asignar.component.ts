import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { TaskService, CargaMesero } from '../../../core/services/task.service';
import { EventService } from '../../../core/services/event.service';
import { Evento, Participante, Tarea } from '../../../core/models/dominio.models';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

type Modo = 'tarea' | 'mesero';

@Component({
  selector: 'app-asignar',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, ModalComponent],
  templateUrl: './asignar.component.html',
})
export default class AsignarComponent implements OnInit {
  evento: Evento | null = null;
  tareas: Tarea[] = [];
  participantes: Participante[] = [];
  cargas: CargaMesero[] = [];
  cargando = true;

  modo: Modo = 'mesero';
  meseroSeleccionado: string | null = null;
  seleccionadas = new Set<string>();
  asignando = false;

  modalDesasignarAbierto = false;
  desasignando = false;

  constructor(private taskService: TaskService, private eventService: EventService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get sinAsignar(): Tarea[] {
    return this.tareas.filter((t) => !t.asignadoA);
  }

  get asignadas(): Tarea[] {
    return this.tareas.filter((t) => !!t.asignadoA);
  }

  cambiarModo(modo: Modo): void {
    this.modo = modo;
    this.meseroSeleccionado = null;
    this.seleccionadas.clear();
  }

  elegirMesero(uid: string): void {
    this.meseroSeleccionado = this.meseroSeleccionado === uid ? null : uid;
    this.seleccionadas.clear();
  }

  estaSeleccionada(tareaId: string): boolean {
    return this.seleccionadas.has(tareaId);
  }

  toggleSeleccion(tareaId: string): void {
    if (this.seleccionadas.has(tareaId)) this.seleccionadas.delete(tareaId);
    else this.seleccionadas.add(tareaId);
  }

  asignarSeleccionadas(): void {
    if (!this.evento || !this.meseroSeleccionado || this.seleccionadas.size === 0) return;
    const uid = this.meseroSeleccionado;
    const tareasAAsignar = this.sinAsignar.filter((t) => this.seleccionadas.has(t.id));

    this.asignando = true;
    forkJoin(
      tareasAAsignar.map((t) => this.taskService.asignar(this.evento!.id, t.id, uid, t.tipo))
    ).subscribe(() => {
      this.asignando = false;
      this.seleccionadas.clear();
      this.cargar();
    });
  }

  /** Desliga TODAS las tareas del evento de sus meseros. No hay forma de deshacerlo. */
  desasignarTodas(): void {
    if (!this.evento || this.asignadas.length === 0) return;
    const eventoId = this.evento.id;

    this.desasignando = true;
    forkJoin(
      this.asignadas.map((t) => this.taskService.asignar(eventoId, t.id, null, t.tipo))
    ).subscribe(() => {
      this.desasignando = false;
      this.modalDesasignarAbierto = false;
      this.cargar();
    });
  }

  cargar(): void {
    this.cargando = true;
    this.eventService.obtenerVigente().subscribe((evento) => {
      this.evento = evento;
      if (!evento) {
        this.cargando = false;
        return;
      }
      this.eventService.listarParticipantes(evento.id).subscribe((p) => {
        this.participantes = p.filter((x) => x.activo);
      });
      this.taskService.listar(evento.id).subscribe((tareas) => {
        this.tareas = tareas;
        this.cargas = TaskService.calcularCarga(tareas);
        this.cargando = false;
      });
    });
  }

  nombreDe(uid: string): string {
    return this.participantes.find((p) => p.uid === uid)?.nombre ?? uid;
  }

  cargaDe(uid: string): number {
    return this.cargas.find((c) => c.uid === uid)?.porcentaje ?? 0;
  }

  asignar(tarea: Tarea, uid: string): void {
    if (!this.evento) return;
    this.taskService.asignar(this.evento.id, tarea.id, uid || null, tarea.tipo).subscribe(() => this.cargar());
  }
}
