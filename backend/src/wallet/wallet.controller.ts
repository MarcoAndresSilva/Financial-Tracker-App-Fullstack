import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';
import { CreateSharedWalletDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('wallets')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Post('shared')
  createSharedWallet(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSharedWalletDto,
  ) {
    return this.walletService.createSharedWallet(userId, dto);
  }
}
