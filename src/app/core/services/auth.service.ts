import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, lastValueFrom, throwError, of, from } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { environment } from '../../../environments/environment';
import { Sesion } from '../models/dominio.models';

/**
 * SECURITY: Using sessionStorage instead of localStorage
 * - sessionStorage: cleared when tab closes, not shared across tabs
 * - localStorage: persistent across tabs (XSS vectors)
 *
 * IDEAL: Use httpOnly cookies with backend proxy for Firebase tokens
 * - Prevents XSS from accessing tokens
 * - Requires backend to handle token refresh
 * See: https://owasp.org/www-community/attacks/xss/
 */
const SESSION_KEY = 'milan_sesion';
const SESSION_STORAGE_TYPE = 'sessionStorage'; // Use 'localStorage' only if necessary
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
  private dbUrl = environment.firebase.databaseURL;

  constructor(private http: HttpClient, private auth: Auth) {}

  // ---------- Sesión local ----------

  /**
   * Get session from storage. Validates token expiration.
   * SECURITY: Uses sessionStorage (cleared on tab close) over localStorage (persistent)
   */
  getSession(): Sesion | null {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const sesion = JSON.parse(raw) as Sesion;

    // Validate token not expired (fail safe: if expiration is in the past, session is invalid)
    if (sesion.expiraEn <= Date.now()) {
      this.logout();
      return null;
    }

    return sesion;
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
    sessionStorage.removeItem(SESSION_KEY);
    // TODO: If using httpOnly cookies, issue logout to backend to clear cookies
  }

  /**
   * Save session to storage (sessionStorage for better XSS protection).
   * SECURITY: sessionStorage is cleared when tab closes, not accessible to other tabs
   * TODO: Migrate to httpOnly cookies + backend session for maximum security
   */
  private guardarSesion(sesion: Sesion): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
  }

  // ---------- Login ----------

  login(email: string, password: string): Observable<Sesion> {
    return this.signIn(email, password).pipe(
      switchMap((auth) => this.cargarPerfilYGuardar(auth))
    );
  }

  /**
   * Google Sign-In con popup.
   * Abre el popup de autenticación de Google, obtiene el idToken, y guarda la sesión.
   * SECURITY: Uses sessionStorage for token storage
   */
  loginWithGoogle(): Observable<Sesion> {
    return from(this.signInWithGooglePopup()).pipe(
      switchMap((auth) => this.cargarPerfilYGuardar(auth))
    );
  }

  private async signInWithGooglePopup(): Promise<IdentityToolkitResponse> {
    try {
      const provider = new GoogleAuthProvider();

      // Usar el Auth inyectado en lugar de inicializar
      const result = await signInWithPopup(this.auth, provider);
      const user = result.user;

      // Obtener el idToken
      const idToken = await user.getIdToken();
      const refreshToken = user.refreshToken || '';

      // Convertir la respuesta al formato IdentityToolkitResponse para reutilizar cargarPerfilYGuardar
      return {
        idToken,
        refreshToken,
        localId: user.uid,
        email: user.email || '',
        expiresIn: '3600', // Firebase devuelve tokens con 1h de vida
      };
    } catch (error: any) {
      // Manejar errores del popup (ej: usuario canceló)
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('El popup fue cerrado. Intenta de nuevo.');
      }
      if (error.code === 'auth/popup-blocked') {
        throw new Error('El popup fue bloqueado. Verifica la configuración del navegador.');
      }
      if (error.code === 'auth/cancelled-popup-request') {
        throw new Error('La solicitud de popup fue cancelada.');
      }
      throw new Error('Error al iniciar sesión con Google. Intenta de nuevo.');
    }
  }

  /** Vuelve a leer rol/estado del negocio (ej: después de que el admin aprueba a alguien). */
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

  // ---------- Authentication (Firebase SDK) ----------

  /**
   * Migrado de Identity Toolkit REST a Firebase SDK moderno.
   * Beneficios:
   * - Built-in automatic token refresh
   * - Better error handling y mensajes tipados
   * - Type-safe API
   * - Soporta múltiples métodos de auth (Google, Apple, etc.)
   */
  private signIn(email: string, password: string): Observable<IdentityToolkitResponse> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      switchMap(async (userCredential) => {
        const user = userCredential.user;
        const idToken = await user.getIdToken();
        const refreshToken = user.refreshToken || '';

        return {
          idToken,
          refreshToken,
          localId: user.uid,
          email: user.email || '',
          expiresIn: '3600', // Firebase devuelve tokens con 1h de vida
        } as IdentityToolkitResponse;
      }),
      catchError((err) => throwError(() => this.mensajeErrorFirebase(err)))
    );
  }

  private signUp(email: string, password: string): Observable<IdentityToolkitResponse> {
    return from(createUserWithEmailAndPassword(this.auth, email, password)).pipe(
      switchMap(async (userCredential) => {
        const user = userCredential.user;
        const idToken = await user.getIdToken();
        const refreshToken = user.refreshToken || '';

        return {
          idToken,
          refreshToken,
          localId: user.uid,
          email: user.email || '',
          expiresIn: '3600',
        } as IdentityToolkitResponse;
      }),
      catchError((err) => throwError(() => this.mensajeErrorFirebase(err)))
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

  /**
   * Manejo de errores del SDK moderno de Firebase.
   * Los códigos de error de Firebase SDK son diferentes a los de Identity Toolkit REST.
   */
  private mensajeErrorFirebase(err: any): string {
    const codigo = err?.code;
    switch (codigo) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Correo o contraseña incorrectos.';
      case 'auth/email-already-in-use':
        return 'Ya existe una cuenta con ese correo.';
      case 'auth/user-disabled':
        return 'Este usuario fue deshabilitado.';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Intenta más tarde.';
      case 'auth/operation-not-allowed':
        return 'Operación no permitida. Contacta con el soporte.';
      default:
        return 'Ocurrió un error inesperado. Intenta de nuevo.';
    }
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
