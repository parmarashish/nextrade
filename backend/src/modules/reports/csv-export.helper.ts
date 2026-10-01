/**
 * Escapes a single cell for CSV formatting.
 * Handles strings with commas, double quotes, and newlines.
 */
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);

  // OWASP CSV / Formula Injection Neutralization:
  // If string starts with =, +, -, @, \t, or \r, prefix with single-quote to force text interpretation
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds a valid RFC 4180 CSV string with UTF-8 BOM for Microsoft Excel compatibility.
 */
export function buildCsv(
  columns: { header: string; key: string }[],
  data: Record<string, any>[]
): string {
  const BOM = '\uFEFF';
  const headerRow = columns.map((col) => escapeCsvCell(col.header)).join(',');
  const rows = data.map((row) =>
    columns.map((col) => escapeCsvCell(row[col.key])).join(',')
  );

  return `${BOM}${headerRow}\r\n${rows.join('\r\n')}\r\n`;
}
