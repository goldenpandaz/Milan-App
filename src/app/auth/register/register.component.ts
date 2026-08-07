import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
})
export default class RegisterComponent {
  cargando = false;
  error = '';

  form: FormGroup;

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  enviar(): void {
    if (this.form.invalid) return;
    this.cargando = true;
    this.error = '';
    const { nombre, email, password } = this.form.value;

    this.authService.registrar(nombre, email, password).subscribe({
      next: () => {
        this.cargando = false;
        this.router.navigate(['/pendiente']);
      },
      error: (mensaje) => {
        this.cargando = false;
        this.error = mensaje;
      },
    });
  }
}
