import { Prisma } from '@prisma/client';

export async function generateOrderNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  // Acquire transaction-scoped PostgreSQL advisory lock to serialize order numbering
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('order_number:nextrade'))`;

  const today = new Date();
  const yy = String(today.getFullYear()).slice(-2);
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const prefix = `ORD-${yy}${mm}${dd}`;

  const lastOrder = await tx.order.findFirst({
    where: {
      orderNumber: { startsWith: prefix },
    },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });

  let seq = 1;
  if (lastOrder) {
    const parts = lastOrder.orderNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `${prefix}-${String(seq).padStart(4, '0')}`;
}
