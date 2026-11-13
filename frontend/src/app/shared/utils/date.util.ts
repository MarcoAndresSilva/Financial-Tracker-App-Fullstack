import { formatDate } from '@angular/common';

/**
 * Utilidades de fecha "solo día" (sin hora).
 *
 * La API guarda las fechas de transacción como `@db.Date` y las devuelve en ISO
 * a medianoche UTC (ej. `"2025-09-01T00:00:00.000Z"`). Construir un `Date` de eso
 * con `new Date(iso)` lo interpreta en el huso local del navegador: en Chile
 * (UTC-4/-3) "1 de septiembre" pasaba a mostrarse como "31 de agosto".
 *
 * Estas funciones tratan la fecha como un día calendario puro, sin husos.
 */

/**
 * ISO de la API (`YYYY-MM-DD...`) → `Date` a medianoche **local**, listo para el
 * datepicker de Material (que trabaja con `Date` en huso local).
 */
export function isoToLocalDate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * `Date` del datepicker → string `YYYY-MM-DD` para mandar a la API.
 */
export function dateToApiString(date: Date): string {
  return formatDate(date, 'yyyy-MM-dd', 'en-US');
}

/**
 * Días calendario como string `YYYY-MM-DD` (Paso 78): para fechas que el
 * usuario no elige con un datepicker (ej. vencimientos de cuotas), se evita
 * `Date` local por completo y se calcula en UTC.
 */
export function isoDay(year: number, monthIndex: number, day: number): string {
  // Ajusta el día al último del mes si no existe (31 → 30/28/29).
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const date = new Date(Date.UTC(year, monthIndex, Math.min(day, lastDay)));
  return date.toISOString().slice(0, 10);
}

/** Suma meses a un día `YYYY-MM-DD` (mismo criterio que el backend, Paso 76). */
export function addMonthsToIsoDay(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return isoDay(y, m - 1 + months, d);
}

/** "1 dic 2026": formato corto de un día, sin el punto de la abreviatura. */
export function formatShortDay(iso: string): string {
  return formatDate(iso.slice(0, 10), 'd MMM y', 'es-CL', 'UTC').replace('.', '');
}

/** "jun 2048" (corto) o "junio 2048" (largo). */
export function formatMonthYear(iso: string, long = false): string {
  return formatDate(iso.slice(0, 10), long ? 'MMMM y' : 'MMM y', 'es-CL', 'UTC').replace('.', '');
}
