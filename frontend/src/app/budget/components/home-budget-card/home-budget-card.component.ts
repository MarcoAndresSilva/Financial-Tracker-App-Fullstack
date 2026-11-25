import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { BudgetLine, BudgetPlan, BudgetStatus } from '../../services/budget.service';

/** Cuántas categorías caben en la card: el Home se mira en segundos. */
const MAX_ATTENTION_ITEMS = 3;
const STATUS_ORDER: Record<BudgetStatus, number> = { OVER: 0, WARNING: 1, OK: 2 };

/**
 * Card del presupuesto en el Home (Paso 84). Componente de presentación: el
 * Home le pasa el plan (lo pide junto con el resto de sus datos, así se
 * refresca al agregar una transacción) y la card solo decide qué mostrar.
 *
 * Responde una pregunta: ¿hay algo del presupuesto que deba mirar hoy?
 * Por eso solo lista las categorías que se pasaron o van cerca del tope;
 * las que van bien están en la página Presupuesto.
 */
@Component({
  selector: 'app-home-budget-card',
  standalone: true,
  imports: [CommonModule, RouterModule, ...MATERIAL_MODULES],
  templateUrl: './home-budget-card.component.html',
  styleUrls: ['./home-budget-card.component.scss'],
})
export class HomeBudgetCardComponent {
  @Input({ required: true }) plan!: BudgetPlan;
  /** "diciembre" */
  @Input({ required: true }) monthName!: string;

  /** ¿Se definió algún presupuesto para este mes? */
  get hasBudget(): boolean {
    return this.plan.categories.some((c) => c.budget !== null);
  }

  /** Lo que se pasó primero, después lo que va cerca; máximo 3. */
  get attention(): BudgetLine[] {
    return this.plan.categories
      .filter((c) => c.status && c.status.status !== 'OK')
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status!.status] - STATUS_ORDER[b.status!.status] ||
          a.name.localeCompare(b.name),
      )
      .slice(0, MAX_ATTENTION_ITEMS);
  }

  /** Cuántas más necesitan atención y no cupieron en la card. */
  get moreAttention(): number {
    const total = this.plan.categories.filter(
      (c) => c.status && c.status.status !== 'OK',
    ).length;
    return total - this.attention.length;
  }

  statusIcon(status: BudgetStatus): string {
    return { OK: 'check_circle', WARNING: 'warning', OVER: 'error' }[status];
  }

  /** Ancho de la barra: tope en 100% (pasarse se dice con texto y color). */
  barWidth(pct: number | null | undefined): number {
    return pct === null || pct === undefined ? 100 : Math.min(100, pct);
  }
}
