import { Module } from '@nestjs/common';
import { SubcategoryController } from './subcategory.controller';
import { SubcategoryService } from './subcategory.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsModule } from '../common/permissions/permissions.module';

@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [SubcategoryController],
  providers: [SubcategoryService],
})
export class SubcategoryModule {}
