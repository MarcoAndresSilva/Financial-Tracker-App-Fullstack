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
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SavingsGoalService } from './savings-goal.service';
import { ContributeDto, CreateSavingsGoalDto, UpdateSavingsGoalDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('savings-goals')
export class SavingsGoalController {
  constructor(private savingsGoalService: SavingsGoalService) {}

  @Post()
  createSavingsGoal(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSavingsGoalDto,
  ) {
    return this.savingsGoalService.createSavingsGoal(userId, dto);
  }

  @Get()
  getSavingsGoalsByWallet(
    @CurrentUser('id') userId: string,
    @Query('walletId', ParseUUIDPipe) walletId: string,
  ) {
    return this.savingsGoalService.getSavingsGoalsByWallet(userId, walletId);
  }

  @Patch(':id')
  updateSavingsGoalById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) goalId: string,
    @Body() dto: UpdateSavingsGoalDto,
  ) {
    return this.savingsGoalService.updateSavingsGoalById(userId, goalId, dto);
  }

  @Post(':id/contributions')
  contributeToGoal(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) goalId: string,
    @Body() dto: ContributeDto,
  ) {
    return this.savingsGoalService.contributeToGoal(userId, goalId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  deleteSavingsGoalById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) goalId: string,
  ) {
    return this.savingsGoalService.deleteSavingsGoalById(userId, goalId);
  }
}
