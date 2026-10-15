import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ItemNav, NAV_POR_ROL } from '../../nav-items';

@Component({
  selector: 'app-sidebar-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="hidden shrink-0 border-r border-plata-200 bg-white py-8 md:flex md:w-64 md:flex-col md:gap-2">
      <a
        *ngFor="let item of items"
        [routerLink]="item.ruta"
        routerLinkActive="bg-plata-900 text-white hover:bg-plata-900"
        class="mx-4 flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium text-black/60 transition hover:bg-plata-100"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="h-6 w-6 shrink-0">
          <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.icono" />
        </svg>
        {{ item.etiqueta }}
      </a>
    </nav>
  `,
})
export class SidebarNavComponent {
  constructor(private authService: AuthService) {}

  get items(): ItemNav[] {
    const rol = this.authService.getSession()?.rol;
    return rol ? NAV_POR_ROL[rol] : [];
  }
}
