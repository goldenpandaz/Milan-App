import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { SidebarNavComponent } from '../sidebar-nav/sidebar-nav.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, BottomNavComponent, SidebarNavComponent],
  template: `
    <div class="flex min-h-screen flex-col bg-plata-50 text-black">
      <app-header />
      <div class="flex flex-1 md:flex-row">
        <app-sidebar-nav />
        <main class="flex-1 overflow-y-auto px-5 py-6 pb-28 md:px-10 md:py-10 md:pb-10">
          <div class="mx-auto w-full max-w-5xl">
            <router-outlet />
          </div>
        </main>
      </div>
      <app-bottom-nav />
    </div>
  `,
})
export class LayoutComponent {}
