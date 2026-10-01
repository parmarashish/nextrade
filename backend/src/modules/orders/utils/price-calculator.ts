import { Decimal } from '@prisma/client/runtime/library';

export interface PriceInput {
  originalUnitPrice: number;
  dealerDiscountPercent: number;
  gstPercentage: number;
  quantity: number;
}

export interface PriceResult {
  unitPrice: number;
  itemTotal: number;
  discountAmount: number;
  gstAmount: number;
  grandTotal: number;
}

export class PriceCalculator {
  /**
   * Round a monetary amount to 2 decimal places (paisa), half-up.
   * Matches Postgres Decimal(10,2) rounding behavior.
   */
  static round2(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  static calculateItemPricing(input: PriceInput): PriceResult {
    const { originalUnitPrice, dealerDiscountPercent, gstPercentage, quantity } = input;

    // Full-precision unit price after dealer discount
    const unitPriceRaw = originalUnitPrice * (1 - dealerDiscountPercent / 100);

    // 1. Unit price after discount (rounded to paisa)
    const unitPrice = PriceCalculator.round2(unitPriceRaw);

    // 2. Line taxable base total extended from unitPriceRaw
    const itemTotal = PriceCalculator.round2(unitPriceRaw * quantity);

    // 3. Discount amount = gross line - net taxable line
    const grossLine = PriceCalculator.round2(originalUnitPrice * quantity);
    const discountAmount = PriceCalculator.round2(grossLine - itemTotal);

    // 4. GST on the rounded net line
    const gstAmount = PriceCalculator.round2((itemTotal * gstPercentage) / 100);

    // 5. Grand total for this line (net taxable + GST)
    const grandTotal = PriceCalculator.round2(itemTotal + gstAmount);

    return {
      unitPrice,
      itemTotal,
      discountAmount,
      gstAmount,
      grandTotal,
    };
  }
}
