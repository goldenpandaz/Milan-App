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
    <nav class="hidden shrink-0 border-r border-plata-200 py-6 md:flex md:w-56 md:flex-col md:gap-1">
      <a
        *ngFor="let item of items"
        [routerLink]="item.ruta"
        routerLinkActive="bg-plata-50 text-plata-700"
        class="mx-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-black/60 transition hover:bg-plata-50"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="h-5 w-5 shrink-0">
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
