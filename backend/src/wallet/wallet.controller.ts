import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';
import { CreateSharedWalletDto, UpdateWalletDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('wallets')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get()
  getMyWallets(@CurrentUser('id') userId: string) {
    return this.walletService.getMyWallets(userId);
  }

  @Get(':id/members')
  getWalletMembers(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) walletId: string,
  ) {
    return this.walletService.getWalletMembers(userId, walletId);
  }

  @Post('shared')
  createSharedWallet(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSharedWalletDto,
  ) {
    return this.walletService.createSharedWallet(userId, dto);
  }

  @Patch(':id')
  updateWallet(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) walletId: string,
    @Body() dto: UpdateWalletDto,
  ) {
    return this.walletService.updateWallet(userId, walletId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  deleteWallet(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) walletId: string,
  ) {
    return this.walletService.deleteWallet(userId, walletId);
  }
}
