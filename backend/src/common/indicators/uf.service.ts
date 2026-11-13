import { Injectable, Logger } from '@nestjs/common';

const MINDICADOR_UF_URL = 'https://mindicador.cl/api/uf';
/** La UF cambia una vez al día: no tiene sentido consultarla más seguido. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** Si mindicador no responde rápido, se sigue sin UF (hay plan B). */
const REQUEST_TIMEOUT_MS = 4000;

interface MindicadorResponse {
  serie?: { fecha: string; valor: number }[];
}

/**
 * Valor de la UF del día, para convertir a pesos las cuotas en UF.
 *
 * Fuente: mindicador.cl (API pública y gratuita con los indicadores del Banco
 * Central). Se guarda en memoria unas horas para no consultarla en cada
 * request. Si la API falla, devuelve el último valor conocido o, si nunca se
 * obtuvo, null: quien la usa tiene un plan B (el último pago registrado) y
 * nunca se inventa un monto.
 */
@Injectable()
export class UfService {
  private readonly logger = new Logger(UfService.name);
  private cache: { value: number; fetchedAt: number } | null = null;

  async getUfValue(): Promise<number | null> {
    // Solo para el stack de pruebas de Playwright (Paso 78): una UF fija hace
    // que los montos esperados no dependan del día ni de internet.
    const fixed = Number(process.env.UF_FIXED_VALUE);
    if (fixed > 0) return fixed;

    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.value;
    }

    try {
      const res = await fetch(MINDICADOR_UF_URL, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body = (await res.json()) as MindicadorResponse;
      const value = body.serie?.[0]?.valor;
      if (typeof value !== 'number' || value <= 0) {
        throw new Error('respuesta sin valor de UF');
      }

      this.cache = { value, fetchedAt: Date.now() };
      return value;
    } catch (error) {
      this.logger.warn(
        `No se pudo obtener la UF de mindicador.cl: ${(error as Error).message}`,
      );
      return this.cache?.value ?? null;
    }
  }
}
