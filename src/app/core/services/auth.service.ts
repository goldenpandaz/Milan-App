import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, lastValueFrom, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Sesion } from '../models/dominio.models';

const SESSION_KEY = 'milan_sesion';
/** Refrescar un poco antes de que venza, para no arriesgarnos a que expire a mitad de un request. */
const MARGEN_REFRESCO_MS = 5 * 60 * 1000;

interface IdentityToolkitResponse {
  idToken: string;
  refreshToken: string;
  localId: string;
  email: string;
  expiresIn: string;
}

interface RefreshTokenResponse {
  id_token: string;
  refresh_token: string;
  expires_in: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private identityUrl = 'https://identitytoolkit.googleapis.com/v1/accounts';
  private dbUrl = environment.firebase.databaseURL;

  constructor(private http: HttpClient) {}

  // ---------- Sesión local ----------

  getSession(): Sesion | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Sesion) : null;
  }

  isLoggedIn(): boolean {
    return !!this.getSession()?.idToken;
  }

  async getIdToken(): Promise<string | null> {
    const sesion = this.getSession();
    if (!sesion) return null;

    if (Date.now() < sesion.expiraEn - MARGEN_REFRESCO_MS) {
      return sesion.idToken;
    }

    try {
      return await this.refrescarToken(sesion);
    } catch {
      // El refresh token también puede vencer o quedar revocado (ej: cambio de contraseña).
      this.logout();
      return null;
    }
  }

  private async refrescarToken(sesion: Sesion): Promise<string> {
    const url = `https://securetoken.googleapis.com/v1/token?key=${environment.firebase.apiKey}`;
    const respuesta = await lastValueFrom(
      this.http.post<RefreshTokenResponse>(url, {
        grant_type: 'refresh_token',
        refresh_token: sesion.refreshToken,
      })
    );

    const actualizada: Sesion = {
      ...sesion,
      idToken: respuesta.id_token,
      refreshToken: respuesta.refresh_token,
      expiraEn: Date.now() + Number(respuesta.expires_in) * 1000,
    };
    this.guardarSesion(actualizada);
    return actualizada.idToken;
  }

  logout(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SESSION_KEY);
  }

  private guardarSesion(sesion: Sesion): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
  }

  // ---------- Login ----------

  login(email: string, password: string): Observable<Sesion> {
    return this.signIn(email, password).pipe(
      switchMap((auth) => this.cargarPerfilYGuardar(auth))
    );
  }

  /** Vuelve a leer rol/estado (ej: después de que el admin aprueba a alguien). */
  refrescarSesion(): Observable<Sesion> {
    const sesion = this.getSession();
    if (!sesion) return throwError(() => 'No hay sesión activa');
    return this.leerPerfil(sesion.localId, sesion.idToken).pipe(
      map((perfil) => {
        const actualizada: Sesion = { ...sesion, ...perfil };
        this.guardarSesion(actualizada);
        return actualizada;
      })
    );
  }

  // ---------- Registro ----------

  /**
   * Alta directa: queda "pendiente" sin rol hasta que un administrador lo asigne.
   * El primer administrador del salón se promueve a mano desde la consola de Firebase
   * (usuarios/{uid}: rol "administrador", estado "activo") — no hay onboarding de negocio.
   */
  registrar(nombre: string, email: string, password: string): Observable<Sesion> {
    return this.signUp(email, password).pipe(
      switchMap((auth) => {
        const ahora = Date.now();
        const altaUsuario$ = this.putConToken(`usuarios/${auth.localId}`, auth.idToken, {
          nombre,
          email,
          rol: null,
          estado: 'pendiente',
          creadoEn: ahora,
        }).pipe(
          catchError(() =>
            throwError(
              () => 'No se pudo guardar tu registro. Puede ser un problema temporal del servidor — intenta de nuevo en un momento.'
            )
          )
        );

        return altaUsuario$.pipe(
          map(() => {
            const sesion: Sesion = {
              idToken: auth.idToken,
              refreshToken: auth.refreshToken,
              expiraEn: this.expiraEnDe(auth),
              localId: auth.localId,
              email,
              nombre,
              rol: null,
              estado: 'pendiente',
            };
            this.guardarSesion(sesion);
            return sesion;
          })
        );
      })
    );
  }

  // ---------- Identity Toolkit ----------

  private signIn(email: string, password: string): Observable<IdentityToolkitResponse> {
    const url = `${this.identityUrl}:signInWithPassword?key=${environment.firebase.apiKey}`;
    return this.http.post<IdentityToolkitResponse>(url, { email, password, returnSecureToken: true }).pipe(
      catchError((err) => throwError(() => this.mensajeError(err)))
    );
  }

  private signUp(email: string, password: string): Observable<IdentityToolkitResponse> {
    const url = `${this.identityUrl}:signUp?key=${environment.firebase.apiKey}`;
    return this.http.post<IdentityToolkitResponse>(url, { email, password, returnSecureToken: true }).pipe(
      catchError((err) => throwError(() => this.mensajeError(err)))
    );
  }

  private cargarPerfilYGuardar(auth: IdentityToolkitResponse): Observable<Sesion> {
    return this.leerPerfil(auth.localId, auth.idToken).pipe(
      map((perfil) => {
        const sesion: Sesion = {
          idToken: auth.idToken,
          refreshToken: auth.refreshToken,
          expiraEn: this.expiraEnDe(auth),
          localId: auth.localId,
          email: auth.email,
          nombre: perfil.nombre,
          rol: perfil.rol,
          estado: perfil.estado,
        };
        this.guardarSesion(sesion);
        return sesion;
      })
    );
  }

  private leerPerfil(uid: string, idToken: string): Observable<Pick<Sesion, 'nombre' | 'rol' | 'estado'>> {
    const url = `${this.dbUrl}/usuarios/${uid}.json?auth=${idToken}`;
    return this.http.get<{ nombre: string; rol: Sesion['rol']; estado: 'pendiente' | 'activo' } | null>(url).pipe(
      map((perfil) => ({
        nombre: perfil?.nombre ?? '',
        rol: perfil?.rol ?? null,
        estado: perfil?.estado ?? null,
      }))
    );
  }

  private putConToken(path: string, idToken: string, value: unknown): Observable<unknown> {
    const url = `${this.dbUrl}/${path}.json?auth=${idToken}`;
    return this.http.put(url, value);
  }

  private expiraEnDe(auth: IdentityToolkitResponse): number {
    return Date.now() + Number(auth.expiresIn) * 1000;
  }

  private mensajeError(err: any): string {
    const codigo = err?.error?.error?.message;
    switch (codigo) {
      case 'EMAIL_NOT_FOUND':
      case 'INVALID_PASSWORD':
      case 'INVALID_LOGIN_CREDENTIALS':
        return 'Correo o contraseña incorrectos.';
      case 'EMAIL_EXISTS':
        return 'Ya existe una cuenta con ese correo.';
      case 'USER_DISABLED':
        return 'Este usuario fue deshabilitado.';
      case 'WEAK_PASSWORD : Password should be at least 6 characters':
        return 'La contraseña debe tener al menos 6 caracteres.';
      default:
        return 'Ocurrió un error inesperado. Intenta de nuevo.';
    }
  }
}
