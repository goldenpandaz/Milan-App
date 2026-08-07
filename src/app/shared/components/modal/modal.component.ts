import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="abierto" class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div class="w-full max-w-md rounded-t-2xl border border-plata-200 bg-white p-5 shadow-xl sm:rounded-2xl">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-base font-semibold text-plata-700">{{ titulo }}</h2>
          <button (click)="cerrar.emit()" class="text-black/50 hover:text-black">✕</button>
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
