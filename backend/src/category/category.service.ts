import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { MembershipRole } from '@prisma/client';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crea una nueva categoría en una cartera específica.
   * Solo el OWNER de la cartera puede crear categorías.
   * @param userId - El ID del usuario que realiza la acción (del token JWT).
   * @param dto - Los datos para crear la categoría (nombre y walletId).
   * @returns La categoría recién creada.
   */
  async createCategory(userId: string, dto: CreateCategoryDto) {
    // 1. Verificar que el usuario sea OWNER de la cartera.
    await this.checkWalletMembership(userId, dto.walletId, true);

    // 2. Crear la categoría.
    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        walletId: dto.walletId,
      },
    });

    return category;
  }

  /**
   * Obtiene todas las categorías de una cartera específica.
   * Cualquier MIEMBRO de la cartera puede ver las categorías.
   * @param userId - El ID del usuario que realiza la acción.
   * @param walletId - El ID de la cartera de la cual obtener las categorías.
   * @returns Una lista de categorías.
   */
  async getCategoriesByWallet(userId: string, walletId: string) {
    // 1. Verificar que el usuario sea al menos MIEMBRO de la cartera.
    await this.checkWalletMembership(userId, walletId);

    // 2. Devolver las categorías.
    return this.prisma.category.findMany({
      where: { walletId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Obtiene una categoría específica por su ID.
   * Cualquier MIEMBRO de la cartera puede ver la categoría.
   * @param userId - El ID del usuario que realiza la acción.
   * @param categoryId - El ID de la categoría a obtener.
   * @returns La categoría encontrada.
   */
  async getCategoryById(userId: string, categoryId: string) {
    // 1. Encontrar la categoría en la base de datos.
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    // 2. Si no existe, lanzar un error 404.
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // 3. Verificar que el usuario sea MIEMBRO de la cartera a la que pertenece la categoría.
    await this.checkWalletMembership(userId, category.walletId);

    // 4. Devolver la categoría.
    return category;
  }

  /**
   * Actualiza una categoría por su ID.
   * Solo el OWNER de la cartera puede actualizarla.
   * @param userId - El ID del usuario que realiza la acción.
   * @param categoryId - El ID de la categoría a actualizar.
   * @param dto - Los datos a actualizar.
   * @returns La categoría actualizada.
   */
  async updateCategoryById(
    userId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ) {
    // 1. Obtener la categoría para saber a qué cartera pertenece.
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // 2. Verificar que el usuario sea OWNER de esa cartera.
    await this.checkWalletMembership(userId, category.walletId, true);

    // 3. Actualizar la categoría.
    return this.prisma.category.update({
      where: { id: categoryId },
      data: { ...dto },
    });
  }

  /**
   * Elimina una categoría por su ID.
   * Solo el OWNER de la cartera puede eliminarla.
   * @param userId - El ID del usuario que realiza la acción.
   * @param categoryId - El ID de la categoría a eliminar.
   * @returns Un mensaje de confirmación.
   */
  async deleteCategoryById(userId: string, categoryId: string) {
    // 1. Obtener la categoría para saber a qué cartera pertenece.
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // 2. Verificar que el usuario sea OWNER de esa cartera.
    await this.checkWalletMembership(userId, category.walletId, true);

    // 3. Eliminar la categoría.
    await this.prisma.category.delete({
      where: { id: categoryId },
    });

    return { message: 'Category deleted successfully' };
  }

  /**
   * Función auxiliar para verificar la membresía y los permisos de un usuario en una cartera.
   * Reutilizable en todos los métodos del CRUD.
   * @param userId - El ID del usuario a verificar.
   * @param walletId - El ID de la cartera a verificar.
   * @param ownerRequired - Si es true, verifica que el usuario sea OWNER. Por defecto es false.
   */
  private async checkWalletMembership(
    userId: string,
    walletId: string,
    ownerRequired = false,
  ) {
    const membership = await this.prisma.walletMembership.findUnique({
      where: {
        userId_walletId: {
          userId,
          walletId,
        },
      },
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
