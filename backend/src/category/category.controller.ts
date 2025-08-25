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
import { CategoryService } from './category.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('categories')
export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  @Post()
  createCategory(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoryService.createCategory(userId, dto);
  }

  @Get()
  getCategoriesByWallet(
    @CurrentUser('id') userId: string,
    @Query('walletId', ParseUUIDPipe) walletId: string,
  ) {
    return this.categoryService.getCategoriesByWallet(userId, walletId);
  }

  @Get(':id')
  getCategoryById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) categoryId: string,
  ) {
    return this.categoryService.getCategoryById(userId, categoryId);
  }

  @Patch(':id')
  updateCategoryById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoryService.updateCategoryById(userId, categoryId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  deleteCategoryById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) categoryId: string,
  ) {
    return this.categoryService.deleteCategoryById(userId, categoryId);
  }
}
