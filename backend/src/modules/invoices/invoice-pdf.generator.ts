import PDFDocument from 'pdfkit';
import {
  amountToWords,
  formatIndianNumber,
  formatPdfCurrency,
} from '../../common/utils.js';

export interface InvoiceOrderData {
  id: string;
  orderNumber: string;
  invoiceNumber: string | null;
  createdAt: Date;
  creditDaysForOrder: number | null;
  subtotal: any;
  discount: any;
  totalGST: any;
  grandTotal: any;
  shippingAddress: any;
  notes?: string | null;
  dealer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    businessName: string | null;
    businessAddress: string | null;
    gstNumber: string | null;
  };
  warehouse: {
    id: string;
    name: string;
    code: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    contactPerson: string | null;
    contactPhone: string | null;
  };
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: any;
    originalUnitPrice: any;
    dealerDiscount: any;
    gstPercentage: any;
    gstAmount: any;
    total: any;
    productVariant: {
      name: string;
      sku: string;
      packingDetails?: string | null;
      product: {
        name: string;
        hsnCode?: string | null;
      };
    };
  }>;
}

/**
 * Generates a professional B2B Tax Invoice PDF using PDFKit.
 * Returns a Buffer of the generated PDF.
 */
export async function generateInvoicePdfBuffer(order: InvoiceOrderData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidth = 595.28;
      const leftMargin = 40;
      const rightMargin = 555.28;
      const printableWidth = rightMargin - leftMargin;

      // ─── 1. Header Section ─────────────────────────────────────
      // Brand Title
      doc.fillColor('#0176D3').font('Helvetica-Bold').fontSize(22).text('NexTrade', leftMargin, 40);
      doc.fillColor('#64748B').font('Helvetica').fontSize(9).text("India's Premier B2B Industrial Marketplace", leftMargin, 66);

      // Warehouse / Dispatch Origin Details
      doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(9).text(`Warehouse: ${order.warehouse.name} (${order.warehouse.code})`, leftMargin, 82);
      doc.font('Helvetica').fontSize(8).fillColor('#475569')
        .text(`${order.warehouse.address}, ${order.warehouse.city}, ${order.warehouse.state} - ${order.warehouse.pincode}`, leftMargin, 94);
      if (order.warehouse.contactPhone) {
        doc.text(`Contact: ${order.warehouse.contactPerson || 'Dispatch Mgr'} | Ph: ${order.warehouse.contactPhone}`, leftMargin, 105);
      }

      // Tax Invoice Title (Top Right)
      doc.fillColor('#032D60').font('Helvetica-Bold').fontSize(16).text('TAX INVOICE', 350, 40, { width: 205, align: 'right' });

      // Invoice Meta Box (Top Right)
      const invNum = order.invoiceNumber || 'DRAFT-INVOICE';
      const orderDate = new Date(order.createdAt);
      const invDateStr = orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      const creditDays = order.creditDaysForOrder ?? 30;
      const dueDate = new Date(orderDate);
      dueDate.setDate(dueDate.getDate() + creditDays);
      const dueDateStr = dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      let metaY = 64;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text('Invoice No: ', 330, metaY, { width: 100, align: 'right' });
      doc.font('Helvetica-Bold').fillColor('#0176D3').text(invNum, 435, metaY, { width: 120, align: 'right' });

      metaY += 13;
      doc.fontSize(8.5).font('Helvetica').fillColor('#64748B').text('Order No: ', 330, metaY, { width: 100, align: 'right' });
      doc.font('Helvetica-Bold').fillColor('#0F172A').text(order.orderNumber, 435, metaY, { width: 120, align: 'right' });

      metaY += 13;
      doc.font('Helvetica').fillColor('#64748B').text('Invoice Date: ', 330, metaY, { width: 100, align: 'right' });
      doc.font('Helvetica').fillColor('#0F172A').text(invDateStr, 435, metaY, { width: 120, align: 'right' });

      metaY += 13;
      doc.font('Helvetica').fillColor('#64748B').text('Payment Due: ', 330, metaY, { width: 100, align: 'right' });
      doc.font('Helvetica-Bold').fillColor('#DC2626').text(`${dueDateStr} (${creditDays}d)`, 435, metaY, { width: 120, align: 'right' });

      // Horizontal Divider
      doc.strokeColor('#0176D3').lineWidth(1.5).moveTo(leftMargin, 126).lineTo(rightMargin, 126).stroke();

      // ─── 2. Bill To & Ship To Sections ─────────────────────────
      const boxY = 135;
      const boxWidth = 250;
      const boxHeight = 85;

      // Bill To Box (Left)
      doc.roundedRect(leftMargin, boxY, boxWidth, boxHeight, 3).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fillColor('#032D60').font('Helvetica-Bold').fontSize(9).text('BILL TO (DEALER)', leftMargin + 8, boxY + 8);

      const dName = order.dealer.businessName || order.dealer.name;
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.5).text(dName, leftMargin + 8, boxY + 22, { width: 235 });
      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      const bAddr = order.dealer.businessAddress || 'Address on file';
      doc.text(bAddr, leftMargin + 8, boxY + 34, { width: 235 });
      doc.text(`GSTIN: ${order.dealer.gstNumber || 'Unregistered'}`, leftMargin + 8, boxY + 56);
      doc.text(`Contact: ${order.dealer.phone} | ${order.dealer.email}`, leftMargin + 8, boxY + 68, { width: 235 });

      // Ship To Box (Right)
      const shipX = 305;
      doc.roundedRect(shipX, boxY, boxWidth, boxHeight, 3).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fillColor('#032D60').font('Helvetica-Bold').fontSize(9).text('SHIP TO (DELIVERY ADDRESS)', shipX + 8, boxY + 8);

      const sAddr = (order.shippingAddress as any) || {};
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.5).text(sAddr.name || dName, shipX + 8, boxY + 22, { width: 235 });
      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      doc.text(`${sAddr.address || ''}`, shipX + 8, boxY + 34, { width: 235 });
      doc.text(`${sAddr.city || ''}, ${sAddr.state || ''} - ${sAddr.pincode || ''}`, shipX + 8, boxY + 56);
      doc.text(`Phone: ${sAddr.phone || order.dealer.phone}`, shipX + 8, boxY + 68);

      // ─── 3. Items Table ─────────────────────────────────────────
      let tableY = 230;
      const col = {
        idx: { x: leftMargin, w: 20 },
        desc: { x: 60, w: 140 },
        hsn: { x: 200, w: 45 },
        qty: { x: 245, w: 35 },
        rate: { x: 280, w: 50 },
        disc: { x: 330, w: 35 },
        taxable: { x: 365, w: 55 },
        gstRate: { x: 420, w: 35 },
        gstAmt: { x: 455, w: 45 },
        total: { x: 500, w: 55 },
      };

      // Table Header Row
      doc.rect(leftMargin, tableY, printableWidth, 18).fill('#032D60');
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF');
      doc.text('#', col.idx.x, tableY + 5, { width: col.idx.w, align: 'center' });
      doc.text('Item / Variant Description', col.desc.x, tableY + 5, { width: col.desc.w, align: 'left' });
      doc.text('HSN', col.hsn.x, tableY + 5, { width: col.hsn.w, align: 'center' });
      doc.text('Qty', col.qty.x, tableY + 5, { width: col.qty.w, align: 'right' });
      doc.text('Rate', col.rate.x, tableY + 5, { width: col.rate.w, align: 'right' });
      doc.text('Disc%', col.disc.x, tableY + 5, { width: col.disc.w, align: 'right' });
      doc.text('Taxable', col.taxable.x, tableY + 5, { width: col.taxable.w, align: 'right' });
      doc.text('GST%', col.gstRate.x, tableY + 5, { width: col.gstRate.w, align: 'right' });
      doc.text('GST', col.gstAmt.x, tableY + 5, { width: col.gstAmt.w, align: 'right' });
      doc.text('Total', col.total.x, tableY + 5, { width: col.total.w, align: 'right' });

      tableY += 18;

      // Table Data Rows
      doc.font('Helvetica').fontSize(7.5);
      let isEven = false;

      order.items.forEach((item, index) => {
        const rowHeight = 22;
        if (isEven) {
          doc.rect(leftMargin, tableY, printableWidth, rowHeight).fill('#F8FAFC');
        }
        isEven = !isEven;

        // Bottom line per row
        doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(leftMargin, tableY + rowHeight).lineTo(rightMargin, tableY + rowHeight).stroke();

        doc.fillColor('#334155');
        // Col #
        doc.text(String(index + 1), col.idx.x, tableY + 4, { width: col.idx.w, align: 'center' });

        // Col Item / Variant
        const itemName = `${item.productVariant.product.name} - ${item.productVariant.name}`;
        doc.font('Helvetica-Bold').fillColor('#0F172A').text(itemName, col.desc.x, tableY + 4, { width: col.desc.w, lineBreak: false, ellipsis: true });
        doc.font('Helvetica').fontSize(6.5).fillColor('#64748B').text(`SKU: ${item.productVariant.sku}`, col.desc.x, tableY + 12);
        doc.fontSize(7.5);

        // Col HSN
        const hsn = item.productVariant.product.hsnCode || '7318';
        doc.fillColor('#475569').text(hsn, col.hsn.x, tableY + 6, { width: col.hsn.w, align: 'center' });

        // Col Qty
        doc.fillColor('#0F172A').text(String(item.quantity), col.qty.x, tableY + 6, { width: col.qty.w, align: 'right' });

        // Col Rate (Base Unit Price)
        const unitPriceNum = Number(item.originalUnitPrice ?? item.unitPrice);
        doc.text(formatIndianNumber(unitPriceNum, 2), col.rate.x, tableY + 6, { width: col.rate.w, align: 'right' });

        // Col Discount%
        const discNum = Number(item.dealerDiscount ?? 0);
        doc.text(discNum > 0 ? `${discNum.toFixed(1)}%` : '-', col.disc.x, tableY + 6, { width: col.disc.w, align: 'right' });

        // Col Taxable Amount (unitPrice * quantity)
        const taxableNum = Number(item.total);
        doc.text(formatIndianNumber(taxableNum, 2), col.taxable.x, tableY + 6, { width: col.taxable.w, align: 'right' });

        // Col GST%
        const gstRateNum = Number(item.gstPercentage);
        doc.text(`${gstRateNum.toFixed(0)}%`, col.gstRate.x, tableY + 6, { width: col.gstRate.w, align: 'right' });

        // Col GST Amount
        const gstAmtNum = Number(item.gstAmount);
        doc.text(formatIndianNumber(gstAmtNum, 2), col.gstAmt.x, tableY + 6, { width: col.gstAmt.w, align: 'right' });

        // Col Total (Taxable + GST)
        const lineTotalNum = taxableNum + gstAmtNum;
        doc.font('Helvetica-Bold').fillColor('#0F172A').text(formatIndianNumber(lineTotalNum, 2), col.total.x, tableY + 6, { width: col.total.w, align: 'right' });
        doc.font('Helvetica');

        tableY += rowHeight;
      });

      // ─── 4. Totals & Amount in Words Section ────────────────────
      tableY += 10;
      const totalsBoxX = 330;
      const totalsBoxWidth = 225;
      const wordsBoxWidth = 280;

      // Amount in Words (Left)
      doc.roundedRect(leftMargin, tableY, wordsBoxWidth, 75, 3).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#032D60').text('TOTAL AMOUNT IN WORDS', leftMargin + 8, tableY + 8);
      const wordsText = amountToWords(order.grandTotal);
      doc.font('Helvetica').fontSize(8.5).fillColor('#1E293B').text(wordsText, leftMargin + 8, tableY + 22, { width: wordsBoxWidth - 16 });

      if (order.notes) {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748B').text('Order Notes: ', leftMargin + 8, tableY + 54);
        doc.font('Helvetica').fillColor('#334155').text(order.notes, leftMargin + 65, tableY + 54, { width: wordsBoxWidth - 75 });
      }

      // Totals Box (Right)
      doc.roundedRect(totalsBoxX, tableY, totalsBoxWidth, 75, 3).fillAndStroke('#FFFFFF', '#E2E8F0');
      let totY = tableY + 6;

      const renderTotalLine = (label: string, value: any, isBold: boolean = false, color: string = '#0F172A') => {
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor('#475569')
          .text(label, totalsBoxX + 10, totY);
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(color)
          .text(formatPdfCurrency(value), totalsBoxX + 100, totY, { width: totalsBoxWidth - 110, align: 'right' });
        totY += 13;
      };

      renderTotalLine('Subtotal (Gross):', Number(order.subtotal) + Number(order.discount));
      if (Number(order.discount) > 0) {
        renderTotalLine('Dealer Discount:', -Number(order.discount), false, '#16A34A');
      }
      renderTotalLine('Net Taxable Value:', order.subtotal);
      renderTotalLine('Total GST (18%):', order.totalGST);

      // Grand Total Highlight
      doc.rect(totalsBoxX, totY - 2, totalsBoxWidth, 20).fill('#0176D3');
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#FFFFFF')
        .text('GRAND TOTAL:', totalsBoxX + 10, totY + 3);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#FFFFFF')
        .text(formatPdfCurrency(order.grandTotal), totalsBoxX + 100, totY + 3, { width: totalsBoxWidth - 110, align: 'right' });

      // ─── 5. Payment Terms & Bank Details ───────────────────────
      const footerSectionY = tableY + 95;
      doc.roundedRect(leftMargin, footerSectionY, printableWidth, 42, 3).fillAndStroke('#F1F5F9', '#E2E8F0');

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#032D60').text('BANK TRANSFER DETAILS & PAYMENT TERMS', leftMargin + 8, footerSectionY + 6);
      doc.font('Helvetica').fontSize(7.5).fillColor('#334155')
        .text(`Account Name: NexTrade B2B Commerce Pvt Ltd  |  A/C No: 00000000000000  |  IFSC: DEMO0000001  |  Bank: Demo Bank`, leftMargin + 8, footerSectionY + 18);
      doc.fillColor('#DC2626').font('Helvetica-Bold')
        .text(`Credit Period: Payment due within ${creditDays} days from invoice date (${dueDateStr}). Interest @18% p.a. applicable on delayed settlements.`, leftMargin + 8, footerSectionY + 29);

      // ─── 6. Bottom Sign-off & Footer ────────────────────────────
      doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(leftMargin, 770).lineTo(rightMargin, 770).stroke();

      doc.font('Helvetica').fontSize(7.5).fillColor('#64748B')
        .text('This is a computer-generated tax invoice and requires no physical signature.', leftMargin, 776, { width: printableWidth, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0176D3')
        .text("NexTrade — India's Premier B2B Industrial Marketplace", leftMargin, 788, { width: printableWidth, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
