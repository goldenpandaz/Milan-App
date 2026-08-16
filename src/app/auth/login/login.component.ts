import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PwaInstallService } from '../../core/pwa-install.service';

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

  appInstalled = false;
  installHelpVisible = false;

  get canInstallApp(): boolean {
    return this.pwaInstallService.canInstall();
  }

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

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private pwaInstallService: PwaInstallService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit(): void {
    if (typeof window === 'undefined') return;

    this.appInstalled = window.matchMedia('(display-mode: standalone)').matches;
  }

  async instalarApp(): Promise<void> {
    if (!this.canInstallApp) {
      this.installHelpVisible = true;
      return;
    }
    await this.pwaInstallService.install();
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

  /**
   * Google Sign-In con popup.
   * Abre el popup de autenticación de Google.
   */
  onLoginWithGoogle(): void {
    this.cargando = true;
    this.error = '';

    this.authService.loginWithGoogle().subscribe({
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
