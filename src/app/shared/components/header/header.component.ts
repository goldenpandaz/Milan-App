import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  template: `
    <header class="sticky top-0 z-10 flex items-center justify-between border-b border-plata-200 bg-white/90 px-4 py-3 backdrop-blur">
      <div class="flex items-center gap-2">
        <img src="branding/logo-milan.png" alt="Milan" class="h-7 w-auto" />
        <span class="text-sm text-black/70">{{ nombre }}</span>
      </div>
      <button
        (click)="salir()"
        class="rounded-full border border-plata-300 px-3 py-1 text-xs text-plata-700 transition hover:bg-plata-50"
      >
        Salir
      </button>
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
