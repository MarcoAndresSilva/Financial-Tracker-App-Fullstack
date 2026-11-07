import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, map, merge, startWith } from 'rxjs';

/**
 * `system` sigue la preferencia del dispositivo (claro u oscuro). Es el valor
 * por defecto hasta que el usuario usa el botón del toolbar por primera vez.
 */
export type ThemeMode = 'system' | 'light' | 'dark';

// Color de la barra del navegador en mobile (meta theme-color): el mismo navy
// del toolbar en cada modo (`--app-chrome` en _tokens.scss).
const CHROME_COLOR = { light: '#243B53', dark: '#1E2D40' };

/**
 * Modo claro/oscuro. Todos los colores de la app son `light-dark(...)` (Paso
 * 67), así que cambiar de modo es solo fijar `color-scheme` en <html>: el
 * navegador resuelve cada color sin recargar estilos. La preferencia se
 * guarda en `localStorage['theme_mode']`; el script inline de index.html la
 * lee y la aplica antes de que cargue Angular, para que no haya un destello
 * claro al abrir la app en modo oscuro.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'theme_mode';
  private readonly systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  private modeSubject = new BehaviorSubject<ThemeMode>(this.loadInitial());
  public mode$: Observable<ThemeMode> = this.modeSubject.asObservable();

  /** Si lo que se ve ahora es oscuro (resuelve `system` contra el dispositivo). */
  public isDark$: Observable<boolean> = merge(
    this.mode$,
    fromEvent(this.systemDark, 'change'),
  ).pipe(
    map(() => this.isDark()),
    startWith(this.isDark()),
  );

  constructor() {
    this.apply(this.modeSubject.getValue());
    // En modo `system`, si el dispositivo cambia de claro a oscuro (ej. de
    // noche), el color-scheme ya lo sigue solo; falta actualizar el meta.
    this.systemDark.addEventListener('change', () =>
      this.updateMetaThemeColor(this.modeSubject.getValue()),
    );
  }

  getMode(): ThemeMode {
    return this.modeSubject.getValue();
  }

  isDark(): boolean {
    const mode = this.modeSubject.getValue();
    return mode === 'dark' || (mode === 'system' && this.systemDark.matches);
  }

  /** Pasa al modo contrario al que se ve ahora y lo deja fijo. */
  toggle(): void {
    this.setMode(this.isDark() ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, mode);
    } catch {
      // Sin storage (modo privado, etc.): el cambio vale solo esta sesión.
    }
    this.apply(mode);
    this.modeSubject.next(mode);
  }

  private apply(mode: ThemeMode): void {
    document.documentElement.style.colorScheme =
      mode === 'system' ? 'light dark' : mode;
    this.updateMetaThemeColor(mode);
  }

  private updateMetaThemeColor(mode: ThemeMode): void {
    const isDark =
      mode === 'dark' || (mode === 'system' && this.systemDark.matches);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', isDark ? CHROME_COLOR.dark : CHROME_COLOR.light);
  }

  private loadInitial(): ThemeMode {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // Sin acceso a storage: se usa el modo del sistema.
    }
    return 'system';
  }
}
