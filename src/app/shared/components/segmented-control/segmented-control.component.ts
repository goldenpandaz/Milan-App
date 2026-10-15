import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface OpcionSegmentada {
  valor: string;
  etiqueta: string;
}

/** Selector de una sola elección con "píldora" deslizante. Pensado para 2–4 opciones. */
@Component({
  selector: 'app-segmented-control',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      role="radiogroup"
      class="relative grid rounded-full bg-plata-100 p-1"
      [style.grid-template-columns]="'repeat(' + opciones.length + ', minmax(0, 1fr))'"
    >
      <span
        aria-hidden="true"
        class="absolute inset-y-1 left-1 rounded-full bg-plata-900 shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
        [style.width]="'calc((100% - 0.5rem) / ' + opciones.length + ')'"
        [style.transform]="'translateX(' + indiceActivo * 100 + '%)'"
      ></span>

      <button
        *ngFor="let opcion of opciones"
        type="button"
        role="radio"
        [attr.aria-checked]="opcion.valor === valor"
        [disabled]="deshabilitado"
        (click)="elegir(opcion.valor)"
        class="relative z-10 rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none disabled:opacity-50"
        [ngClass]="opcion.valor === valor ? 'text-white' : 'text-plata-600 active:text-plata-800'"
      >
        {{ opcion.etiqueta }}
      </button>
    </div>
  `,
})
export class SegmentedControlComponent {
  @Input() opciones: OpcionSegmentada[] = [];
  @Input() valor: string | null = null;
  @Input() deshabilitado = false;
  @Output() valorChange = new EventEmitter<string>();

  get indiceActivo(): number {
    return Math.max(0, this.opciones.findIndex((o) => o.valor === this.valor));
  }

  elegir(valor: string): void {
    if (this.deshabilitado || valor === this.valor) return;
    this.valorChange.emit(valor);
  }
}
