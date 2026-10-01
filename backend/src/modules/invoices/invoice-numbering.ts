import { Prisma } from '@prisma/client';
import { extractWarehouseCodeForInvoice, getIndianFinancialYear } from '../../common/utils.js';

/**
 * Allocates a sequential, race-free invoice number for an order inside a Prisma transaction.
 * Number format: INV-{WAREHOUSE_CODE}-{FY}-{SEQ} (e.g. INV-MUM-2627-00001)
 */
export async function allocateInvoiceNumber(
  warehouseId: string,
  warehouseCode: string,
  tx: Prisma.TransactionClient,
  date: Date = new Date()
): Promise<string> {
  const fy = getIndianFinancialYear(date);
  const whPrefix = extractWarehouseCodeForInvoice(warehouseCode);

  // Advisory lock scoped per warehouse and financial year
  const lockKey = `inv_seq:${warehouseId}:${fy}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  // Upsert the sequence record: seed at 0 then increment to 1 on first insert, or increment existing
  await tx.invoiceSequence.upsert({
    where: {
      warehouseId_periodKey: {
        warehouseId,
        periodKey: fy,
      },
    },
    create: {
      warehouseId,
      periodKey: fy,
      lastNumber: 0,
    },
    update: {},
  });

  const updatedSeq = await tx.invoiceSequence.update({
    where: {
      warehouseId_periodKey: {
        warehouseId,
        periodKey: fy,
      },
    },
    data: {
      lastNumber: { increment: 1 },
    },
    select: {
      lastNumber: true,
    },
  });

  const seqStr = String(updatedSeq.lastNumber).padStart(5, '0');
  return `INV-${whPrefix}-${fy}-${seqStr}`;
}
