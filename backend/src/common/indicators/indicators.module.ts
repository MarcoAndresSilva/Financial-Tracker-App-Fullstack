import { Module } from '@nestjs/common';
import { UfService } from './uf.service';

/** Indicadores económicos externos (por ahora, la UF). */
@Module({
  providers: [UfService],
  exports: [UfService],
})
export class IndicatorsModule {}
