import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateDebtDto } from './create-debt.dto';

export class UpdateDebtDto extends PartialType(
  OmitType(CreateDebtDto, ['walletId'] as const),
) {}
