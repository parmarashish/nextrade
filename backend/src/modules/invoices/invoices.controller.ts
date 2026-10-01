import { Response } from 'express';
import { invoicesService } from './invoices.service.js';
import { AuthenticatedRequest } from '../../common/types.js';
import { extractRequestContext } from '../../auth/session.helper.js';

export class InvoicesController {
  findAll = async (req: AuthenticatedRequest, res: Response) => {
    const result = await invoicesService.findAll(req.query as any, req.user!);
    return res.status(200).json({ success: true, ...result });
  };

  findById = async (req: AuthenticatedRequest, res: Response) => {
    const invoice = await invoicesService.findById(req.params.id, req.user!);
    return res.status(200).json({ success: true, data: invoice });
  };

  downloadPdf = async (req: AuthenticatedRequest, res: Response) => {
    const { buffer, filename } = await invoicesService.generatePdf(
      req.params.id,
      req.user!
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  };

  generateInvoice = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const order = await invoicesService.generateInvoiceForOrder(
      req.params.orderId,
      req.user!.id,
      ctx
    );

    return res.status(200).json({
      success: true,
      message: `Invoice #${order.invoiceNumber} generated successfully`,
      data: order,
    });
  };
}

export const invoicesController = new InvoicesController();
