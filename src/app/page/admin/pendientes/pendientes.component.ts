import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../core/services/user.service';
import { Rol, Usuario } from '../../../core/models/dominio.models';

@Component({
  selector: 'app-pendientes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pendientes.component.html',
})
export default class PendientesComponent implements OnInit {
  pendientes: Usuario[] = [];
  cargando = true;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.userService.listarPendientes().subscribe((usuarios) => {
      this.pendientes = usuarios;
      this.cargando = false;
    });
  }

  asignar(usuario: Usuario, rol: Rol): void {
    this.userService.asignarRol(usuario.uid, rol).subscribe(() => this.cargar());
  }
}
