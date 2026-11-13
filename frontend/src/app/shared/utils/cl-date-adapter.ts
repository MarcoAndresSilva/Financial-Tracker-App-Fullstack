import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/** día [-/.] mes [-/.] año (4 o 2 dígitos), ej. "01-12-2026", "1/12/26", "15.3.2027". */
const DAY_MONTH_YEAR = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/;

/**
 * Adaptador de fechas para Chile (Paso 79).
 *
 * El NativeDateAdapter de Material lee lo que se tipea con `Date.parse`, que
 * ignora el idioma y asume el formato de EE.UU. (mes-día-año): "01-12-2026" se
 * guardaba como 12 de enero. Este adaptador hereda todo del nativo (mostrar
 * fechas, calendario, nombres de meses) y solo reemplaza la LECTURA: siempre
 * día-mes-año.
 */
@Injectable()
export class ClDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return new Date(value);
    if (typeof value !== 'string') return super.parse(value, parseFormat);

    const match = value.trim().match(DAY_MONTH_YEAR);
    if (!match) return this.invalid();

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);

    // `new Date(2026, 1, 31)` no falla: "se desborda" al 3 de marzo. Si al
    // armarla el día o el mes cambiaron, la fecha no existe (ej. 31-02-2026).
    const date = new Date(year, month - 1, day);
    const exists =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
    return exists ? date : this.invalid();
  }
}
