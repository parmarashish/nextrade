import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number into Indian currency system representation (e.g. ₹1,23,456.00)
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '₹0.00';
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(num)) return '₹0.00';

  const parts = num.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  const isNegative = integerPart.startsWith('-');
  if (isNegative) integerPart = integerPart.slice(1);

  if (integerPart.length > 3) {
    const last3 = integerPart.slice(-3);
    const rest = integerPart.slice(0, -3);
    const formattedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    integerPart = `${formattedRest},${last3}`;
  }

  return `${isNegative ? '-' : ''}₹${integerPart}.${decimalPart}`;
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  return `${day} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Locale-independent short months (ICU renders September as "Sept" in en-IN). */
export const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "1 item" / "2 items" */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Compact axis currency: ₹750, ₹1.5k, ₹2k, ₹1.2L (no lossy rounding of ticks). */
export function formatCompactCurrency(val: number): string {
  const trim = (n: number) => String(parseFloat(n.toFixed(1)));
  if (val >= 10000000) return `₹${trim(val / 10000000)}Cr`;
  if (val >= 100000) return `₹${trim(val / 100000)}L`;
  if (val >= 1000) return `₹${trim(val / 1000)}k`;
  return `₹${val}`;
}

/**
 * Convert a numerical amount into Indian currency in words
 * e.g. 1495.30 -> "Rupees One Thousand Four Hundred Ninety-Five and Thirty Paise Only"
 */
export function numberToWordsIndian(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return 'Rupees Zero Only';
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(num) || num === 0) return 'Rupees Zero Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n < 20) return ones[n];
    const unit = n % 10;
    return `${tens[Math.floor(n / 10)]}${unit ? '-' + ones[unit] : ''}`;
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    let res = '';
    if (hundred > 0) res += `${ones[hundred]} Hundred`;
    if (remainder > 0) {
      if (res) res += ' ';
      res += convertTwoDigits(remainder);
    }
    return res;
  }

  const parts = Math.abs(num).toFixed(2).split('.');
  let integerPart = parseInt(parts[0], 10);
  const paise = parseInt(parts[1], 10);

  if (integerPart === 0 && paise === 0) return 'Rupees Zero Only';

  let words = '';

  const crore = Math.floor(integerPart / 10000000);
  integerPart %= 10000000;

  const lakh = Math.floor(integerPart / 100000);
  integerPart %= 100000;

  const thousand = Math.floor(integerPart / 1000);
  integerPart %= 1000;

  const hundred = integerPart;

  if (crore > 0) {
    words += `${convertTwoDigits(crore)} Crore `;
  }
  if (lakh > 0) {
    words += `${convertTwoDigits(lakh)} Lakh `;
  }
  if (thousand > 0) {
    words += `${convertTwoDigits(thousand)} Thousand `;
  }
  if (hundred > 0) {
    words += `${convertThreeDigits(hundred)} `;
  }

  words = words.trim();
  let result = words ? `Rupees ${words}` : '';

  if (paise > 0) {
    const paiseWords = convertTwoDigits(paise);
    if (result) {
      result += ` and ${paiseWords} Paise`;
    } else {
      result = `${paiseWords} Paise`;
    }
  }

  return `${result} Only`;
}

