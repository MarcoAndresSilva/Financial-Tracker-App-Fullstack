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
