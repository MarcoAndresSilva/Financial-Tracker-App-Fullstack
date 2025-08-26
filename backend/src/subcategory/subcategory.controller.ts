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
import { SubcategoryService } from './subcategory.service';
import { CreateSubcategoryDto, UpdateSubcategoryDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('subcategories')
export class SubcategoryController {
  constructor(private subcategoryService: SubcategoryService) {}

  // POST /subcategories
  @Post()
  createSubcategory(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSubcategoryDto,
  ) {
    return this.subcategoryService.createSubcategory(userId, dto);
  }

  // GET /subcategories?categoryId=...
  @Get()
  getSubcategoriesByCategory(
    @CurrentUser('id') userId: string,
    @Query('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.subcategoryService.getSubcategoriesByCategory(
      userId,
      categoryId,
    );
  }

  // GET /subcategories/:id
  @Get(':id')
  getSubcategoryById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) subcategoryId: string,
  ) {
    return this.subcategoryService.getSubcategoryById(userId, subcategoryId);
  }

  // PATCH /subcategories/:id
  @Patch(':id')
  updateSubcategoryById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) subcategoryId: string,
    @Body() dto: UpdateSubcategoryDto,
  ) {
    return this.subcategoryService.updateSubcategoryById(
      userId,
      subcategoryId,
      dto,
    );
  }

  // DELETE /subcategories/:id
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  deleteSubcategoryById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) subcategoryId: string,
  ) {
    return this.subcategoryService.deleteSubcategoryById(userId, subcategoryId);
  }
}
