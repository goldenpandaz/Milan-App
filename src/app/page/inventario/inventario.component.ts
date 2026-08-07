import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryService } from '../../core/services/inventory.service';
import { EventService } from '../../core/services/event.service';
import { AuthService } from '../../core/services/auth.service';
import { Evento, ItemInventario } from '../../core/models/dominio.models';
import { BadgeComponent } from '../../shared/components/badge/badge.component';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BadgeComponent],
  templateUrl: './inventario.component.html',
})
export default class InventarioComponent implements OnInit {
  evento: Evento | null = null;
  items: ItemInventario[] = [];
  cargando = true;
  form: FormGroup;

  constructor(
    private inventoryService: InventoryService,
    private eventService: EventService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(0)]],
      falta: [false],
      nota: [''],
    });
  }

  ngOnInit(): void {
    this.cargar();
  }

  get esAdmin(): boolean {
    return this.authService.getSession()?.rol === 'administrador';
  }

  get uid(): string {
    return this.authService.getSession()?.localId ?? '';
  }

  cargar(): void {
    this.cargando = true;
    this.eventService.obtenerVigente().subscribe((evento) => {
      this.evento = evento;
      if (!evento) {
        this.cargando = false;
        return;
      }
      this.inventoryService.listar(evento.id).subscribe((items) => {
        this.items = items;
        this.cargando = false;
      });
    });
  }

  agregar(): void {
    if (this.form.invalid || !this.evento) return;
    this.inventoryService.agregarItem(this.evento.id, this.form.value, this.uid).subscribe(() => {
      this.form.reset({ cantidad: 1, falta: false, nota: '' });
      this.cargar();
    });
  }

  confirmar(item: ItemInventario): void {
    if (!this.evento) return;
    this.inventoryService.confirmarAdmin(this.evento.id, item.id).subscribe(() => this.cargar());
  }
}
