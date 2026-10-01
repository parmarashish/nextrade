import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/app-error.js';
import { generateSlug } from '../../utils/slug.js';
import { CreateBrandInput, UpdateBrandInput } from './brands.dto.js';
import { RequestContext } from '../../common/types.js';

export class BrandsService {
  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const baseSlug = generateSlug(name) || 'brand';
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await prisma.brand.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing || existing.id === excludeId) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  // ─── List Brands ─────────────────────────────────────────────

  async findAll(includeInactive = false) {
    return prisma.brand.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  // ─── Get Brand By ID ─────────────────────────────────────────

  async findById(id: string) {
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!brand) {
      throw AppError.notFound('Brand not found');
    }

    return brand;
  }

  // ─── Create Brand (Admin Only) ───────────────────────────────

  async create(input: CreateBrandInput, userId: string, ctx: RequestContext) {
    const slug = await this.generateUniqueSlug(input.name);

    const brand = await prisma.brand.create({
      data: {
        name: input.name.trim(),
        slug,
        logo: input.logo || null,
        description: input.description?.trim() || null,
        isActive: input.isActive ?? true,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'CREATE',
        entityType: 'BRAND',
        entityId: brand.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { name: brand.name, slug: brand.slug },
      },
    });

    return brand;
  }

  // ─── Update Brand (Admin Only) ───────────────────────────────

  async update(id: string, input: UpdateBrandInput, userId: string, ctx: RequestContext) {
    const existing = await prisma.brand.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('Brand not found');
    }

    let slug = existing.slug;
    if (input.name && input.name.trim() !== existing.name) {
      slug = await this.generateUniqueSlug(input.name, id);
    }

    const updated = await prisma.brand.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        slug,
        ...(input.logo !== undefined ? { logo: input.logo || null } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entityType: 'BRAND',
        entityId: id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { changes: input },
      },
    });

    return updated;
  }

  // ─── Delete Brand (Admin Only) ───────────────────────────────

  async delete(id: string, userId: string, ctx: RequestContext) {
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!brand) {
      throw AppError.notFound('Brand not found');
    }

    if (brand._count.products > 0) {
      throw AppError.badRequest(
        `Cannot delete brand "${brand.name}" because it is linked to ${brand._count.products} products. Reassign or delete products first.`
      );
    }

    await prisma.brand.delete({ where: { id } });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'DELETE',
        entityType: 'BRAND',
        entityId: id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { name: brand.name },
      },
    });

    return { message: `Brand "${brand.name}" deleted successfully` };
  }
}

export const brandsService = new BrandsService();
