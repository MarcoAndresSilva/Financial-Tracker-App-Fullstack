import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubcategoryDto, UpdateSubcategoryDto } from './dto';
import { MembershipRole } from '@prisma/client';

@Injectable()
export class SubcategoryService {
  constructor(private prisma: PrismaService) {}

  async createSubcategory(userId: string, dto: CreateSubcategoryDto) {
    const parentCategory = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!parentCategory) {
      throw new NotFoundException('Parent category not found');
    }

    await this.checkWalletMembership(userId, parentCategory.walletId, true);

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

    await this.checkWalletMembership(userId, parentCategory.walletId);

    return this.prisma.subcategory.findMany({
      where: { categoryId },
      orderBy: { name: 'asc' },
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

    await this.checkWalletMembership(userId, subcategory.category.walletId);

    return subcategory;
  }

  async updateSubcategoryById(
    userId: string,
    subcategoryId: string,
    dto: UpdateSubcategoryDto,
  ) {
    const subcategory = await this.getSubcategoryById(userId, subcategoryId);

    await this.checkWalletMembership(
      userId,
      subcategory.category.walletId,
      true,
    );

    return this.prisma.subcategory.update({
      where: { id: subcategoryId },
      data: { ...dto },
    });
  }

  async deleteSubcategoryById(userId: string, subcategoryId: string) {
    const subcategory = await this.getSubcategoryById(userId, subcategoryId);
    await this.checkWalletMembership(
      userId,
      subcategory.category.walletId,
      true,
    );

    await this.prisma.subcategory.delete({
      where: { id: subcategoryId },
    });

    return { message: 'Subcategory deleted successfully' };
  }

  private async checkWalletMembership(
    userId: string,
    walletId: string,
    ownerRequired = false,
  ) {
    const membership = await this.prisma.walletMembership.findUnique({
      where: { userId_walletId: { userId, walletId } },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this wallet');
    }

    if (ownerRequired && membership.role !== MembershipRole.OWNER) {
      throw new ForbiddenException(
        'You must be an owner to perform this action',
      );
    }
  }
}
