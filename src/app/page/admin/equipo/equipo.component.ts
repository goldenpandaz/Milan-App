import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { Rol, Usuario } from '../../../core/models/dominio.models';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';

@Component({
  selector: 'app-equipo',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent],
  templateUrl: './equipo.component.html',
})
export default class EquipoComponent implements OnInit {
  equipo: Usuario[] = [];
  cargando = true;

  constructor(private userService: UserService, private authService: AuthService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get miUid(): string {
    return this.authService.getSession()?.localId ?? '';
  }

  cargar(): void {
    this.cargando = true;
    this.userService.listarEquipo().subscribe((usuarios) => {
      this.equipo = usuarios.filter((u) => u.estado === 'activo');
      this.cargando = false;
    });
  }

  cambiarRol(usuario: Usuario, rol: Rol): void {
    this.userService.asignarRol(usuario.uid, rol).subscribe(() => this.cargar());
  }

  quitarAcceso(usuario: Usuario): void {
    this.userService.quitarAcceso(usuario.uid).subscribe(() => this.cargar());
  }
}
