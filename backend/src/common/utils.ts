import { Prisma } from '@prisma/client';

/**
 * Format a number/Decimal into Indian number system representation.
 * e.g. 123456.78 -> "1,23,456.78"
 */
export function formatIndianNumber(
  val: number | string | Prisma.Decimal | null | undefined,
  decimals: number = 2
): string {
  if (val === null || val === undefined) return '0.00';
  const num = typeof val === 'number' ? val : Number(val.toString());
  if (isNaN(num)) return '0.00';

  const parts = num.toFixed(decimals).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1] !== undefined ? `.${parts[1]}` : '';

  const isNegative = integerPart.startsWith('-');
  if (isNegative) integerPart = integerPart.slice(1);

  // Indian numbering regex: last 3 digits, then groups of 2 digits
  if (integerPart.length > 3) {
    const last3 = integerPart.slice(-3);
    const rest = integerPart.slice(0, -3);
    const formattedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    integerPart = `${formattedRest},${last3}`;
  }

  return `${isNegative ? '-' : ''}${integerPart}${decimalPart}`;
}

/**
 * Formats a currency amount with Indian Rupee symbol (₹).
 * e.g. 123456 -> "₹1,23,456.00"
 */
export function formatCurrency(
  val: number | string | Prisma.Decimal | null | undefined,
  prefix: string = '₹'
): string {
  return `${prefix}${formatIndianNumber(val, 2)}`;
}

/**
 * Formats currency safely for standard PDFKit fonts (which don't include Unicode ₹).
 * e.g. 123456 -> "Rs. 1,23,456.00"
 */
export function formatPdfCurrency(
  val: number | string | Prisma.Decimal | null | undefined
): string {
  return `Rs. ${formatIndianNumber(val, 2)}`;
}

/**
 * Returns the Indian Financial Year string for a given date.
 * Fiscal year runs from April 1 to March 31.
 * e.g.
 *   April 2026 -> "2627" (2026-27)
 *   September 2026 -> "2627"
 *   January 2027 -> "2627"
 *   April 2027 -> "2728"
 */
export function getIndianFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  let startYear: number;
  let endYear: number;

  if (month >= 4) {
    startYear = year;
    endYear = year + 1;
  } else {
    startYear = year - 1;
    endYear = year;
  }

  const startStr = String(startYear).slice(-2);
  const endStr = String(endYear).slice(-2);
  return `${startStr}${endStr}`;
}

/**
 * Extracts a concise warehouse code for invoice numbering.
 * e.g. "WH-MUM-01" -> "MUM"
 *      "WH-DEL-02" -> "DEL"
 *      "BLR-MAIN"  -> "BLR"
 */
export function extractWarehouseCodeForInvoice(warehouseCode: string): string {
  if (!warehouseCode) return 'GEN';
  const parts = warehouseCode.split('-');
  if (parts.length >= 2 && parts[0].toUpperCase() === 'WH') {
    return parts[1].toUpperCase();
  }
  if (parts.length > 0 && parts[0].length >= 3) {
    return parts[0].toUpperCase();
  }
  return warehouseCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 5) || 'GEN';
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ' ' + ONES[o] : '');
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(ONES[h] + ' Hundred');
  if (r > 0) parts.push(twoDigits(r));
  return parts.join(' ');
}

/**
 * Converts a number to Indian currency words representation.
 * e.g. 1888.00 -> "One Thousand Eight Hundred Eighty Eight Rupees Only"
 */
export function amountToWords(amount: number | string | Prisma.Decimal): string {
  const value = typeof amount === 'number' ? amount : Number(amount.toString());
  if (isNaN(value) || value === 0) return 'Zero Rupees Only';

  const isNegative = value < 0;
  let num = Math.abs(value);
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  const crore = Math.floor(rupees / 10000000);
  num = rupees % 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = num;

  const parts: string[] = [];
  if (crore > 0) parts.push(twoDigits(crore) + ' Crore');
  if (lakh > 0) parts.push(twoDigits(lakh) + ' Lakh');
  if (thousand > 0) parts.push(twoDigits(thousand) + ' Thousand');
  if (hundred > 0) parts.push(threeDigits(hundred));

  let words = parts.join(' ').trim();
  if (words) words += ' Rupees';

  if (paise > 0) {
    words += (words ? ' and ' : '') + twoDigits(paise) + ' Paise';
  }

  return (isNegative ? 'Minus ' : '') + words + ' Only';
}
