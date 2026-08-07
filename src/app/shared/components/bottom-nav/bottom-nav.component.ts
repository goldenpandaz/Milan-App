import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ItemNav, NAV_POR_ROL } from '../../nav-items';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="fixed inset-x-0 bottom-0 z-20 flex border-t border-plata-200 bg-white/95 backdrop-blur md:hidden">
      <a
        *ngFor="let item of items"
        [routerLink]="item.ruta"
        routerLinkActive="text-plata-700"
        class="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-black/40 transition"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="h-5 w-5">
          <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.icono" />
        </svg>
        {{ item.etiqueta }}
      </a>
    </nav>
  `,
})
export class BottomNavComponent {
  constructor(private authService: AuthService) {}

  get items(): ItemNav[] {
    const rol = this.authService.getSession()?.rol;
    return rol ? NAV_POR_ROL[rol] : [];
  }
}
