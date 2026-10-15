import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { Usuario } from '../../../core/models/dominio.models';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-equipo',
  standalone: true,
  imports: [CommonModule, BadgeComponent, ModalComponent],
  templateUrl: './equipo.component.html',
})
export default class EquipoComponent implements OnInit {
  equipo: Usuario[] = [];
  cargando = true;
  error = '';

  /** Persona a la que se quiere designar jefe mientras ya hay otro: pide confirmación antes de reemplazarlo. */
  aDesignar: Usuario | null = null;

  constructor(private userService: UserService, private authService: AuthService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get miUid(): string {
    return this.authService.getSession()?.localId ?? '';
  }

  get jefeActual(): Usuario | null {
    return this.equipo.find((u) => u.rol === 'jefe_mesero') ?? null;
  }

  cargar(): void {
    this.cargando = true;
    this.userService.listarEquipo().subscribe({
      next: (usuarios) => {
        this.equipo = this.ordenar(usuarios);
        this.cargando = false;
      },
      error: () => this.fallar('No se pudo cargar el equipo.'),
    });
  }

  /** Administrador, jefe de meseros, trabajadores activos y al final los inactivos; por nombre dentro de cada grupo. */
  private ordenar(usuarios: Usuario[]): Usuario[] {
    const peso = (u: Usuario) =>
      u.rol === 'administrador' ? 0 : u.estado === 'inactivo' ? 3 : u.rol === 'jefe_mesero' ? 1 : 2;
    return [...usuarios].sort((a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre, 'es'));
  }

  alternarActivo(usuario: Usuario): void {
    if (usuario.rol === 'administrador' || usuario.uid === this.miUid) return;
    const estado = usuario.estado === 'activo' ? 'inactivo' : 'activo';
    this.userService.cambiarEstado(usuario, estado).subscribe({
      next: () => this.cargar(),
      error: () => this.fallar('No se pudo cambiar el estado.'),
    });
  }

  pedirJefe(usuario: Usuario): void {
    if (usuario.estado !== 'activo' || usuario.rol === 'administrador') return;
    if (this.jefeActual && this.jefeActual.uid !== usuario.uid) {
      this.aDesignar = usuario;
      return;
    }
    this.designar(usuario);
  }

  confirmarJefe(): void {
    if (!this.aDesignar) return;
    const usuario = this.aDesignar;
    this.aDesignar = null;
    this.designar(usuario);
  }

  quitarJefe(usuario: Usuario): void {
    this.userService.quitarJefe(usuario.uid).subscribe({
      next: () => this.cargar(),
      error: () => this.fallar('No se pudo quitar al jefe de meseros.'),
    });
  }

  private designar(usuario: Usuario): void {
    this.userService.designarJefe(usuario.uid, this.jefeActual?.uid ?? null).subscribe({
      next: () => this.cargar(),
      error: () => this.fallar('No se pudo designar al jefe de meseros.'),
    });
  }

  private fallar(mensaje: string): void {
    this.error = mensaje;
    this.cargando = false;
  }
}
