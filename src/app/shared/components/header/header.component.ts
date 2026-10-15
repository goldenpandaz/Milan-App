import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  template: `
    <header class="sticky top-0 z-10 flex items-center justify-between border-b border-plata-200 bg-white/90 px-5 py-4 backdrop-blur md:px-10">
      <div class="flex items-center gap-3">
        <img src="branding/logo-milan.png" alt="Milan" class="h-10 w-auto md:h-11" />
        <span class="hidden text-base font-medium text-black/70 sm:inline">{{ nombre }}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-black/70 sm:hidden">{{ nombre }}</span>
        <button
          (click)="salir()"
          class="rounded-full border border-plata-300 bg-white px-4 py-2 text-sm font-medium text-plata-700 transition hover:bg-plata-100"
        >
          Salir
        </button>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  constructor(private authService: AuthService, private router: Router) {}

  get nombre(): string {
    return this.authService.getSession()?.nombre || '';
  }

  salir(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
