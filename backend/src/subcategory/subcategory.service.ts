import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubcategoryDto, UpdateSubcategoryDto } from './dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PermissionsService } from '../common/permissions/permissions.service';

@Injectable()
export class SubcategoryService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  async createSubcategory(userId: string, dto: CreateSubcategoryDto) {
    const parentCategory = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!parentCategory) {
      throw new NotFoundException('Parent category not found');
    }

    await this.permissions.checkWalletMembership(
      userId,
      parentCategory.walletId,
    );

    return this.prisma.subcategory.create({
      data: {
        name: dto.name,
        categoryId: dto.categoryId,
      },
    });
  }

  async getSubcategoriesByCategory(userId: string, categoryId: string) {
    const parentCategory = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!parentCategory) {
      throw new NotFoundException('Parent category not found');
    }

    await this.permissions.checkWalletMembership(
      userId,
      parentCategory.walletId,
    );

    return this.prisma.subcategory.findMany({
      where: { categoryId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSubcategoryById(userId: string, subcategoryId: string) {
    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id: subcategoryId },
      include: { category: true },
    });

    if (!subcategory) {
      throw new NotFoundException('Subcategory not found');
    }

    await this.permissions.checkWalletMembership(
      userId,
      subcategory.category.walletId,
    );

    return subcategory;
  }

  async updateSubcategoryById(
    userId: string,
    subcategoryId: string,
    dto: UpdateSubcategoryDto,
  ) {
    const subcategory = await this.getSubcategoryById(userId, subcategoryId);

    await this.permissions.checkWalletMembership(
      userId,
      subcategory.category.walletId,
    );

    return this.prisma.subcategory.update({
      where: { id: subcategoryId },
      data: { ...dto },
    });
  }

  async deleteSubcategoryById(userId: string, subcategoryId: string) {
    const subcategory = await this.getSubcategoryById(userId, subcategoryId);
    await this.permissions.checkWalletMembership(
      userId,
      subcategory.category.walletId,
    );

    try {
      await this.prisma.subcategory.delete({
        where: { id: subcategoryId },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'No se puede eliminar: la subcategoría tiene transacciones asociadas.',
        );
      }
      throw error;
    }

    return { message: 'Subcategory deleted successfully' };
  }
}
