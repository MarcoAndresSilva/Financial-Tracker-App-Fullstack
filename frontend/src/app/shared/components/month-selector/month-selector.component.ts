import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  MatDatepicker,
  MatDatepickerModule,
} from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { map } from 'rxjs';

import { PeriodContextService } from '../../../core/services/period-context.service';

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/**
 * Navegador de meses compartido: flechas `‹ Agosto 2026 ›` + calendario de
 * mes/año al tocar la etiqueta. Escribe en `PeriodContextService`, así que
 * cualquier página suscrita a `activePeriod$` reacciona sola.
 */
@Component({
  selector: 'app-month-selector',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './month-selector.component.html',
  styleUrls: ['./month-selector.component.scss'],
})
export class MonthSelectorComponent {
  private periodContext = inject(PeriodContextService);

  label$ = this.periodContext.activePeriod$.pipe(
    map((p) => `${MONTHS_ES[p.month - 1]} ${p.year}`),
  );
  isCurrent$ = this.periodContext.activePeriod$.pipe(
    map((p) => this.periodContext.isCurrentMonth(p)),
  );
  // El datepicker trabaja con `Date`; el día 1 del mes activo alcanza.
  pickerValue$ = this.periodContext.activePeriod$.pipe(
    map((p) => new Date(p.year, p.month - 1, 1)),
  );

  prev(): void {
    this.periodContext.prevMonth();
  }

  next(): void {
    this.periodContext.nextMonth();
  }

  today(): void {
    this.periodContext.goToCurrent();
  }

  onMonthSelected(selected: Date, picker: MatDatepicker<Date>): void {
    this.periodContext.setPeriod(
      selected.getFullYear(),
      selected.getMonth() + 1,
    );
    picker.close();
  }
}
