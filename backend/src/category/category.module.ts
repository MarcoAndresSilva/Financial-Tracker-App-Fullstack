import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsModule } from '../common/permissions/permissions.module';

@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
