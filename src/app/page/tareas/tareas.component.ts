import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TaskService } from '../../core/services/task.service';
import { EventService } from '../../core/services/event.service';
import { AuthService } from '../../core/services/auth.service';
import { Evento, Rol, Tarea, TipoTarea } from '../../core/models/dominio.models';
import { BadgeComponent } from '../../shared/components/badge/badge.component';

@Component({
  selector: 'app-tareas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BadgeComponent],
  templateUrl: './tareas.component.html',
})
export default class TareasComponent implements OnInit {
  evento: Evento | null = null;
  tareas: Tarea[] = [];
  cargando = true;
  form: FormGroup;

  constructor(
    private taskService: TaskService,
    private eventService: EventService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      titulo: ['', Validators.required],
      tipo: ['general' as TipoTarea, Validators.required],
    });
  }

  ngOnInit(): void {
    this.cargar();
  }

  get rol(): Rol | null {
    return this.authService.getSession()?.rol ?? null;
  }

  get uid(): string {
    return this.authService.getSession()?.localId ?? '';
  }

  get puedeGestionar(): boolean {
    return this.rol === 'administrador' || this.rol === 'jefe_mesero';
  }

  get tareasVisibles(): Tarea[] {
    if (this.puedeGestionar) return this.tareas;
    return this.tareas.filter((t) => t.asignadoA === this.uid);
  }

  cargar(): void {
    this.cargando = true;
    this.eventService.obtenerVigente().subscribe((evento) => {
      this.evento = evento;
      if (!evento) {
        this.tareas = [];
        this.cargando = false;
        return;
      }
      this.taskService.listar(evento.id).subscribe((tareas) => {
        this.tareas = tareas;
        this.cargando = false;
      });
    });
  }

  crear(): void {
    if (this.form.invalid || !this.evento) return;
    const { titulo, tipo } = this.form.value;
    this.taskService.crear(this.evento.id, titulo, tipo, this.uid).subscribe(() => {
      this.form.reset({ tipo: 'general' });
      this.cargar();
    });
  }

  eliminar(tarea: Tarea): void {
    if (!this.evento) return;
    this.taskService.eliminar(this.evento.id, tarea.id).subscribe(() => this.cargar());
  }

  toggleHecho(tarea: Tarea): void {
    if (!this.evento) return;
    const nuevoEstado = tarea.estado === 'hecho' ? 'pendiente' : 'hecho';
    this.taskService.marcarEstado(this.evento.id, tarea.id, nuevoEstado).subscribe(() => this.cargar());
  }
}
