import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export default class LoginComponent implements OnInit {
  form: FormGroup;
  cargando = false;
  error = '';

  canInstallApp = false;
  appInstalled = false;
  installHelpVisible = false;
  private deferredPrompt: any = null;

  get isIos(): boolean {
    return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  get isAndroid(): boolean {
    return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  }

  /** Chrome en Android a veces tarda o directamente no dispara el prompt nativo. */
  get mostrarAyudaGenerica(): boolean {
    return !this.appInstalled && !this.isIos && !this.canInstallApp;
  }

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit(): void {
    if (typeof window === 'undefined') return;

    this.appInstalled = window.matchMedia('(display-mode: standalone)').matches;

    window.addEventListener('beforeinstallprompt', (event: Event) => {
      event.preventDefault();
      this.deferredPrompt = event;
      this.canInstallApp = true;
    });

    window.addEventListener('appinstalled', () => {
      this.appInstalled = true;
      this.canInstallApp = false;
    });
  }

  async instalarApp(): Promise<void> {
    if (!this.deferredPrompt) {
      this.installHelpVisible = true;
      return;
    }
    this.deferredPrompt.prompt();
    await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstallApp = false;
  }

  invalido(campo: string): boolean {
    const control = this.form.get(campo);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  enviar(): void {
    if (this.form.invalid) return;
    this.cargando = true;
    this.error = '';
    const { email, password } = this.form.value;

    this.authService.login(email, password).subscribe({
      next: (sesion) => {
        this.cargando = false;
        this.router.navigate([sesion.estado === 'pendiente' ? '/pendiente' : '/app']);
      },
      error: (mensaje) => {
        this.cargando = false;
        this.error = mensaje;
      },
    });
  }
}
