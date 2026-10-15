import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="abierto" class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div class="w-full max-w-lg rounded-t-3xl border border-plata-200 bg-white p-6 shadow-xl sm:rounded-3xl">
        <div class="mb-5 flex items-center justify-between">
          <h2 class="text-xl font-semibold text-plata-900">{{ titulo }}</h2>
          <button (click)="cerrar.emit()" class="flex h-9 w-9 items-center justify-center rounded-full text-black/50 hover:bg-plata-100 hover:text-black" aria-label="Cerrar">✕</button>
        </div>
        <ng-content />
      </div>
    </div>
  `,
})
export class ModalComponent {
  @Input() abierto = false;
  @Input() titulo = '';
  @Output() cerrar = new EventEmitter<void>();
}
