import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/** Un mes calendario. `month` es 1–12 (no el 0–11 de `Date`). */
export interface Period {
  year: number;
  month: number;
}

/**
 * "Pizarrón" del mes activo, análogo a `WalletContextService` para la wallet.
 * Las páginas con datos por mes (Home, lista de transacciones, historial) se
 * suscriben a `activePeriod$` y recargan cuando cambia. Se persiste en
 * `localStorage` para que un refresco no te devuelva al mes actual.
 */
@Injectable({ providedIn: 'root' })
export class PeriodContextService {
  private readonly STORAGE_KEY = 'active_period';

  private periodSubject = new BehaviorSubject<Period>(this.loadInitial());
  public activePeriod$: Observable<Period> = this.periodSubject.asObservable();

  getPeriod(): Period {
    return this.periodSubject.getValue();
  }

  setPeriod(year: number, month: number): void {
    const period: Period = { year, month };
    this.persist(period);
    this.periodSubject.next(period);
  }

  prevMonth(): void {
    const { year, month } = this.getPeriod();
    this.setPeriod(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  }

  nextMonth(): void {
    const { year, month } = this.getPeriod();
    this.setPeriod(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
  }

  goToCurrent(): void {
    const now = new Date();
    this.setPeriod(now.getFullYear(), now.getMonth() + 1);
  }

  isCurrentMonth(period: Period = this.getPeriod()): boolean {
    const now = new Date();
    return (
      period.year === now.getFullYear() && period.month === now.getMonth() + 1
    );
  }

  private loadInitial(): Period {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Period>;
        if (
          typeof parsed.year === 'number' &&
          typeof parsed.month === 'number' &&
          parsed.month >= 1 &&
          parsed.month <= 12
        ) {
          return { year: parsed.year, month: parsed.month };
        }
      }
    } catch {
      // localStorage no disponible o valor corrupto — caemos al mes actual.
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  private persist(period: Period): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(period));
    } catch {
      // Sin persistencia (modo privado, storage bloqueado) — no es crítico.
    }
  }
}
