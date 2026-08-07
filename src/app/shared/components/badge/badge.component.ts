import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type TonoBadge = 'neutro' | 'plata' | 'ok' | 'alerta';

const CLASES: Record<TonoBadge, string> = {
  neutro: 'bg-black/5 text-black/60',
  plata: 'bg-plata-100 text-plata-700 border border-plata-300',
  ok: 'bg-emerald-50 text-emerald-700',
  alerta: 'bg-red-50 text-red-600',
};

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="rounded-full px-2.5 py-1 text-[11px] font-medium" [ngClass]="CLASES[tono]">{{ texto }}</span>`,
})
export class BadgeComponent {
  @Input() texto = '';
  @Input() tono: TonoBadge = 'neutro';
  protected readonly CLASES = CLASES;
}
