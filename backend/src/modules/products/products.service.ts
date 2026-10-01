import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/app-error.js';
import { generateSlug } from '../../utils/slug.js';
import {
  CreateProductInput,
  CreateVariantInput,
  ProductQueryParams,
  UpdateProductInput,
  UpdateVariantInput,
} from './products.dto.js';
import { AuthUserPayload, RequestContext } from '../../common/types.js';
import { UserRole } from '@prisma/client';

export class ProductsService {
  // ─── Generate Category Code ──────────────────────────────────

  private getCategoryCode(categoryName: string): string {
    const clean = categoryName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return clean.slice(0, 3).padEnd(3, 'X');
  }

  // ─── Generate Product SKU: NEX-{CAT}-{00001} ─────────────────

  private async generateProductSku(categoryId: string): Promise<string> {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { name: true },
    });

    const categoryCode = this.getCategoryCode(category?.name || 'GEN');
    const prefix = `NEX-${categoryCode}-`;

    const lastProduct = await prisma.product.findFirst({
      where: { sku: { startsWith: prefix } },
      orderBy: { sku: 'desc' },
      select: { sku: true },
    });

    let nextNum = 1;
    if (lastProduct) {
      const parts = lastProduct.sku.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextNum = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextNum).padStart(5, '0')}`;
  }

  // ─── Generate Unique Slug ────────────────────────────────────

  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const baseSlug = generateSlug(name) || 'product';
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await prisma.product.findUnique({
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

  // ─── Validate Level 3 Category ───────────────────────────────

  private async validateCategoryIsLevel3(categoryId: string) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, level: true },
    });

    if (!category) {
      throw AppError.notFound('Category not found');
    }

    if (category.level !== 3) {
      throw AppError.badRequest(
        `Products can only be assigned to Level 3 (Child) categories. Selected category "${category.name}" is Level ${category.level}.`
      );
    }

    return category;
  }

  // ─── Create Product (Admin Only) ─────────────────────────────

  async create(input: CreateProductInput, userId: string, ctx: RequestContext) {
    // 1. Verify Level 3 Category
    await this.validateCategoryIsLevel3(input.categoryId);

    // 2. Verify Brand if provided
    if (input.brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: input.brandId } });
      if (!brand) throw AppError.notFound('Brand not found');
    }

    // 3. Generate SKU & Slug
    const sku = await this.generateProductSku(input.categoryId);
    const slug = await this.generateUniqueSlug(input.name);

    // 4. Prepare Variants (default to 1 variant if none provided)
    const rawVariants = input.variants && input.variants.length > 0
      ? input.variants
      : [
          {
            name: 'Standard',
            price: 100,
            mrp: 120,
            costPrice: 80,
            gstPercentage: 18,
            minimumQuantity: 1,
            packingDetails: '1 pc',
            isActive: true,
          },
        ];

    const variantsData = rawVariants.map((v, index) => ({
      name: v.name.trim(),
      sku: `${sku}-V${index + 1}`,
      price: new Decimal(v.price),
      mrp: v.mrp ? new Decimal(v.mrp) : null,
      costPrice: v.costPrice ? new Decimal(v.costPrice) : null,
      gstPercentage: new Decimal(v.gstPercentage ?? 18),
      minimumQuantity: v.minimumQuantity ?? 1,
      packingDetails: v.packingDetails?.trim() || null,
      isActive: v.isActive ?? true,
    }));

    const product = await prisma.product.create({
      data: {
        name: input.name.trim(),
        slug,
        sku,
        description: input.description?.trim() || null,
        categoryId: input.categoryId,
        brandId: input.brandId || null,
        images: input.images || [],
        isActive: input.isActive ?? true,
        variants: {
          create: variantsData,
        },
      },
      include: {
        category: { select: { id: true, name: true, slug: true, level: true } },
        brand: { select: { id: true, name: true, slug: true, logo: true } },
        variants: true,
      },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'CREATE',
        entityType: 'PRODUCT',
        entityId: product.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { name: product.name, sku: product.sku, variantCount: product.variants.length },
      },
    });

    return product;
  }

  // ─── Update Product (Admin Only) ─────────────────────────────

  async update(id: string, input: UpdateProductInput, userId: string, ctx: RequestContext) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('Product not found');
    }

    if (input.categoryId && input.categoryId !== existing.categoryId) {
      await this.validateCategoryIsLevel3(input.categoryId);
    }

    if (input.brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: input.brandId } });
      if (!brand) throw AppError.notFound('Brand not found');
    }

    let slug = existing.slug;
    if (input.name && input.name.trim() !== existing.name) {
      slug = await this.generateUniqueSlug(input.name, id);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        slug,
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
        ...(input.images ? { images: input.images } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: {
        category: { select: { id: true, name: true, slug: true, level: true } },
        brand: { select: { id: true, name: true, slug: true, logo: true } },
        variants: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entityType: 'PRODUCT',
        entityId: id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { changes: input },
      },
    });

    return updated;
  }

  // ─── Delete Product (Admin Only) ─────────────────────────────

  async delete(id: string, userId: string, ctx: RequestContext) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          include: {
            orderItems: { select: { id: true } },
            stocks: { select: { quantity: true, reservedQuantity: true } },
          },
        },
      },
    });

    if (!product) {
      throw AppError.notFound('Product not found');
    }

    // Check for active orders
    const totalOrderItems = product.variants.reduce(
      (acc, v) => acc + v.orderItems.length,
      0
    );

    if (totalOrderItems > 0) {
      throw AppError.badRequest(
        `Cannot delete product "${product.name}" because it is part of ${totalOrderItems} order line item(s).`
      );
    }

    // Check for stock
    const hasActiveStock = product.variants.some((v) =>
      v.stocks.some((s) => s.quantity > 0 || s.reservedQuantity > 0)
    );

    if (hasActiveStock) {
      throw AppError.badRequest(
        `Cannot delete product "${product.name}" because physical or reserved stock exists in one or more warehouses.`
      );
    }

    await prisma.product.delete({ where: { id } });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'DELETE',
        entityType: 'PRODUCT',
        entityId: id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { name: product.name, sku: product.sku },
      },
    });

    return { message: `Product "${product.name}" deleted successfully` };
  }

  // ─── Add Variant to Product ──────────────────────────────────

  async addVariant(productId: string, input: CreateVariantInput, userId: string, ctx: RequestContext) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });

    if (!product) {
      throw AppError.notFound('Product not found');
    }

    const nextIndex = product.variants.length + 1;
    const variantSku = `${product.sku}-V${nextIndex}`;

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        name: input.name.trim(),
        sku: variantSku,
        price: new Decimal(input.price),
        mrp: input.mrp ? new Decimal(input.mrp) : null,
        costPrice: input.costPrice ? new Decimal(input.costPrice) : null,
        gstPercentage: new Decimal(input.gstPercentage ?? 18),
        minimumQuantity: input.minimumQuantity ?? 1,
        packingDetails: input.packingDetails?.trim() || null,
        isActive: input.isActive ?? true,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'CREATE',
        entityType: 'PRODUCT_VARIANT',
        entityId: variant.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { productName: product.name, variantSku },
      },
    });

    return variant;
  }

  // ─── Update Variant ──────────────────────────────────────────

  async updateVariant(
    productId: string,
    variantId: string,
    input: UpdateVariantInput,
    userId: string,
    ctx: RequestContext
  ) {
    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });

    if (!existing) {
      throw AppError.notFound('Product variant not found');
    }

    const updated = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.price !== undefined ? { price: new Decimal(input.price) } : {}),
        ...(input.mrp !== undefined ? { mrp: input.mrp ? new Decimal(input.mrp) : null } : {}),
        ...(input.costPrice !== undefined ? { costPrice: input.costPrice ? new Decimal(input.costPrice) : null } : {}),
        ...(input.gstPercentage !== undefined ? { gstPercentage: new Decimal(input.gstPercentage) } : {}),
        ...(input.minimumQuantity !== undefined ? { minimumQuantity: input.minimumQuantity } : {}),
        ...(input.packingDetails !== undefined ? { packingDetails: input.packingDetails?.trim() || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entityType: 'PRODUCT_VARIANT',
        entityId: variantId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { changes: input },
      },
    });

    return updated;
  }

  // ─── Delete Variant ──────────────────────────────────────────

  async deleteVariant(productId: string, variantId: string, userId: string, ctx: RequestContext) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      include: {
        orderItems: { select: { id: true } },
        stocks: { select: { quantity: true, reservedQuantity: true } },
        product: {
          include: {
            variants: { select: { id: true } },
          },
        },
      },
    });

    if (!variant) {
      throw AppError.notFound('Product variant not found');
    }

    if (variant.product.variants.length <= 1) {
      throw AppError.badRequest('A product must have at least one variant. Cannot delete the only variant.');
    }

    if (variant.orderItems.length > 0) {
      throw AppError.badRequest(
        `Cannot delete variant "${variant.name}" because it is referenced in ${variant.orderItems.length} order(s).`
      );
    }

    const hasStock = variant.stocks.some((s) => s.quantity > 0 || s.reservedQuantity > 0);
    if (hasStock) {
      throw AppError.badRequest(
        `Cannot delete variant "${variant.name}" because stock exists in one or more warehouses.`
      );
    }

    await prisma.productVariant.delete({ where: { id: variantId } });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'DELETE',
        entityType: 'PRODUCT_VARIANT',
        entityId: variantId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { variantName: variant.name, sku: variant.sku },
      },
    });

    return { message: `Variant "${variant.name}" deleted successfully` };
  }

  // ─── Get Single Product By ID with Dealer Pricing ─────────────

  async findById(id: string, user?: AuthUserPayload) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            level: true,
            parentId: true,
          },
        },
        brand: {
          select: { id: true, name: true, slug: true, logo: true },
        },
        variants: {
          include: {
            stocks: {
              select: {
                warehouseId: true,
                quantity: true,
                reservedQuantity: true,
                warehouse: { select: { id: true, name: true, code: true } },
              },
            },
          },
          orderBy: { sku: 'asc' },
        },
      },
    });

    if (!product) {
      throw AppError.notFound('Product not found');
    }

    // Determine dealer discount % if logged in as DEALER
    let dealerDiscountPercent = 0;
    if (user && user.role === UserRole.DEALER) {
      const discount = await prisma.dealerCategoryDiscount.findUnique({
        where: {
          dealerId_categoryId: {
            dealerId: user.id,
            categoryId: product.categoryId,
          },
        },
        select: { discountPercentage: true },
      });

      if (discount) {
        dealerDiscountPercent = Number(discount.discountPercentage);
      }
    }

    // Format variants with stock summaries and dealer pricing
    const formattedVariants = product.variants.map((v) => {
      const wholesalePrice = Number(v.price);
      const discountAmount = Math.round((wholesalePrice * (dealerDiscountPercent / 100)) * 100) / 100;
      const effectivePrice = Math.round((wholesalePrice - discountAmount) * 100) / 100;

      const totalQuantity = v.stocks.reduce((sum, s) => sum + s.quantity, 0);
      const totalReserved = v.stocks.reduce((sum, s) => sum + s.reservedQuantity, 0);
      const availableQuantity = Math.max(0, totalQuantity - totalReserved);

      return {
        id: v.id,
        productId: v.productId,
        name: v.name,
        sku: v.sku,
        price: wholesalePrice,
        mrp: v.mrp ? Number(v.mrp) : null,
        costPrice: user?.role === UserRole.ADMIN && v.costPrice ? Number(v.costPrice) : undefined,
        gstPercentage: Number(v.gstPercentage),
        minimumQuantity: v.minimumQuantity,
        packingDetails: v.packingDetails,
        isActive: v.isActive,
        // Dealer Pricing fields
        dealerDiscountPercent,
        effectivePrice,
        // Inventory summary
        inventory: {
          totalQuantity,
          reservedQuantity: totalReserved,
          availableQuantity,
          warehouses: v.stocks.map((s) => ({
            warehouseId: s.warehouseId,
            warehouseName: s.warehouse.name,
            warehouseCode: s.warehouse.code,
            available: Math.max(0, s.quantity - s.reservedQuantity),
          })),
        },
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      };
    });

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      description: product.description,
      images: product.images,
      isActive: product.isActive,
      category: product.category,
      brand: product.brand,
      dealerDiscountPercent,
      variants: formattedVariants,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  // ─── List Products (Paginated & Filtered) ────────────────────

  async findAll(query: ProductQueryParams, user?: AuthUserPayload) {
    const {
      page = 1,
      limit = 50,
      search,
      categoryId,
      brandId,
      isActive,
      minPrice,
      maxPrice,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.variants = {
        some: {
          price: {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          },
        },
      };
    }

    // If dealer is requesting, fetch all category discounts for this dealer upfront
    const categoryDiscountMap = new Map<string, number>();
    if (user && user.role === UserRole.DEALER) {
      const discounts = await prisma.dealerCategoryDiscount.findMany({
        where: { dealerId: user.id },
        select: { categoryId: true, discountPercentage: true },
      });
      discounts.forEach((d) =>
        categoryDiscountMap.set(d.categoryId, Number(d.discountPercentage))
      );
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              level: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  parent: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          brand: { select: { id: true, name: true, slug: true, logo: true } },
          variants: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
              mrp: true,
              gstPercentage: true,
              minimumQuantity: true,
              stocks: {
                select: {
                  quantity: true,
                  reservedQuantity: true,
                  reorderPoint: true,
                },
              },
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const formatted = products.map((p) => {
      const discountPercent = categoryDiscountMap.get(p.categoryId) || 0;
      const prices = p.variants.map((v) => Number(v.price));
      const minBasePrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxBasePrice = prices.length > 0 ? Math.max(...prices) : 0;

      const minEffectivePrice = Math.round((minBasePrice * (1 - discountPercent / 100)) * 100) / 100;
      const maxEffectivePrice = Math.round((maxBasePrice * (1 - discountPercent / 100)) * 100) / 100;

      let totalStock = 0;
      let hasLowStock = false;
      p.variants.forEach((v) => {
        v.stocks?.forEach((s) => {
          const avail = Math.max(0, s.quantity - s.reservedQuantity);
          totalStock += avail;
          if (avail <= s.reorderPoint) {
            hasLowStock = true;
          }
        });
      });

      const l1Name = p.category?.parent?.parent?.name || p.category?.parent?.name;
      const categoryBreadcrumb = l1Name ? `${l1Name} > ${p.category.name}` : p.category.name;

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        description: p.description,
        images: p.images,
        isActive: p.isActive,
        category: p.category,
        categoryBreadcrumb,
        brand: p.brand,
        variantCount: p.variants.length,
        priceRange: {
          min: minBasePrice,
          max: maxBasePrice,
        },
        dealerDiscountPercent: discountPercent,
        effectivePriceRange: {
          min: minEffectivePrice,
          max: maxEffectivePrice,
        },
        totalStock,
        hasLowStock,
        createdAt: p.createdAt,
      };
    });

    return {
      data: formatted,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const productsService = new ProductsService();
