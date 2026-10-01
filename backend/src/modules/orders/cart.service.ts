import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/app-error.js';
import { AddToCartInput, UpdateCartItemInput } from './orders.dto.js';
import { AuthUserPayload } from '../../common/types.js';
import { PriceCalculator } from './utils/price-calculator.js';

export class CartService {
  // ─── Get Cart with Computed Pricing & Availability ───────────

  async getCart(user: AuthUserPayload) {
    const dealer = await prisma.user.findUnique({
      where: { id: user.id },
      select: { assignedWarehouseId: true },
    });

    const warehouseId = dealer?.assignedWarehouseId;

    const cartItems = await prisma.cartItem.findMany({
      where: { userId: user.id },
      include: {
        productVariant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                categoryId: true,
                images: true,
              },
            },
            stocks: warehouseId
              ? {
                  where: { warehouseId },
                  select: { quantity: true, reservedQuantity: true },
                }
              : false,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch all category discounts for this dealer
    const categoryDiscounts = await prisma.dealerCategoryDiscount.findMany({
      where: { dealerId: user.id },
      select: { categoryId: true, discountPercentage: true },
    });
    const discountMap = new Map<string, number>();
    categoryDiscounts.forEach((d) =>
      discountMap.set(d.categoryId, Number(d.discountPercentage))
    );

    let subtotal = 0;
    let totalDiscount = 0;
    let totalGST = 0;
    let totalItems = 0;

    const items = cartItems.map((item) => {
      const v = item.productVariant;
      const originalUnitPrice = Number(v.price);
      const discountPercent = discountMap.get(v.product.categoryId) || 0;
      const gstPercentage = Number(v.gstPercentage);

      const pricing = PriceCalculator.calculateItemPricing({
        originalUnitPrice,
        dealerDiscountPercent: discountPercent,
        gstPercentage,
        quantity: item.quantity,
      });

      subtotal += pricing.itemTotal;
      totalDiscount += pricing.discountAmount;
      totalGST += pricing.gstAmount;
      totalItems += item.quantity;

      // Available stock in assigned warehouse
      let availableStock: number | null = null;
      if (v.stocks && v.stocks.length > 0) {
        const s = v.stocks[0];
        availableStock = Math.max(0, s.quantity - s.reservedQuantity);
      }

      return {
        id: item.id,
        productVariantId: v.id,
        variantName: v.name,
        sku: v.sku,
        productName: v.product.name,
        productImages: v.product.images,
        quantity: item.quantity,
        originalUnitPrice,
        dealerDiscountPercent: discountPercent,
        unitPrice: pricing.unitPrice,
        taxableTotal: pricing.itemTotal,
        gstPercentage,
        gstAmount: pricing.gstAmount,
        lineTotal: pricing.grandTotal,
        availableStock,
        minimumQuantity: v.minimumQuantity,
        packingDetails: v.packingDetails,
      };
    });

    subtotal = PriceCalculator.round2(subtotal);
    totalDiscount = PriceCalculator.round2(totalDiscount);
    totalGST = PriceCalculator.round2(totalGST);
    const grandTotal = PriceCalculator.round2(subtotal + totalGST);

    return {
      items,
      summary: {
        totalItems,
        subtotal,
        totalDiscount,
        totalGST,
        grandTotal,
      },
    };
  }

  // ─── Add to Cart (Upsert) ────────────────────────────────────

  async addToCart(userId: string, input: AddToCartInput) {
    const { productVariantId, quantity } = input;

    const variant = await prisma.productVariant.findUnique({
      where: { id: productVariantId },
      select: { id: true, isActive: true, minimumQuantity: true },
    });

    if (!variant || !variant.isActive) {
      throw AppError.notFound('Product variant not found or inactive');
    }

    const existing = await prisma.cartItem.findUnique({
      where: {
        userId_productVariantId: {
          userId,
          productVariantId,
        },
      },
    });

    if (existing) {
      return prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    }

    return prisma.cartItem.create({
      data: {
        userId,
        productVariantId,
        quantity,
      },
    });
  }

  // ─── Update Cart Item Quantity ───────────────────────────────

  async updateCartItem(userId: string, itemId: string, input: UpdateCartItemInput) {
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, userId },
      include: { productVariant: { select: { minimumQuantity: true } } },
    });

    if (!item) {
      throw AppError.notFound('Cart item not found');
    }

    if (input.quantity < (item.productVariant.minimumQuantity ?? 1)) {
      throw AppError.badRequest(
        `Quantity must be at least ${item.productVariant.minimumQuantity} for this item`
      );
    }

    return prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: input.quantity },
    });
  }

  // ─── Remove Item from Cart ───────────────────────────────────

  async removeFromCart(userId: string, itemId: string) {
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, userId },
    });

    if (!item) {
      throw AppError.notFound('Cart item not found');
    }

    await prisma.cartItem.delete({ where: { id: itemId } });
    return { message: 'Item removed from cart' };
  }

  // ─── Clear Entire Cart ───────────────────────────────────────

  async clearCart(userId: string) {
    await prisma.cartItem.deleteMany({ where: { userId } });
    return { message: 'Cart cleared' };
  }
}

export const cartService = new CartService();
