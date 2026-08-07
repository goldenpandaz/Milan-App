import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class RtdbService {
  private baseUrl = environment.firebase.databaseURL;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private withAuth(path: string, extra: Record<string, string> = {}): Observable<string> {
    return from(this.authService.getIdToken()).pipe(
      switchMap((token) => {
        const params = new URLSearchParams({ ...(token ? { auth: token } : {}), ...extra });
        const query = params.toString();
        return of(`${this.baseUrl}/${path}.json${query ? `?${query}` : ''}`);
      })
    );
  }

  get<T>(path: string): Observable<T> {
    return this.withAuth(path).pipe(switchMap((url) => this.http.get<T>(url)));
  }

  put<T>(path: string, value: unknown): Observable<T> {
    return this.withAuth(path).pipe(switchMap((url) => this.http.put<T>(url, value)));
  }

  patch<T>(path: string, value: unknown): Observable<T> {
    return this.withAuth(path).pipe(switchMap((url) => this.http.patch<T>(url, value)));
  }

  push<T extends { name: string }>(path: string, value: unknown): Observable<T> {
    return this.withAuth(path).pipe(switchMap((url) => this.http.post<T>(url, value)));
  }

  remove<T>(path: string): Observable<T> {
    return this.withAuth(path).pipe(switchMap((url) => this.http.delete<T>(url)));
  }

  /** Query por igualdad de un campo hijo (requiere índice ".indexOn" en las reglas). */
  getByChild<T>(path: string, child: string, value: string): Observable<T> {
    return this.withAuth(path, {
      orderBy: JSON.stringify(child),
      equalTo: JSON.stringify(value),
    }).pipe(switchMap((url) => this.http.get<T>(url)));
  }

  /** Convierte el objeto-de-objetos que devuelve RTDB en un arreglo con `id`. */
  static toArray<T extends object>(obj: Record<string, T> | null): (T & { id: string })[] {
    if (!obj) return [];
    return Object.entries(obj).map(([id, value]) => ({ ...(value as T), id }));
  }
}
