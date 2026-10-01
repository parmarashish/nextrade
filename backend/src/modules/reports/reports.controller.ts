import { Request, Response } from 'express';
import { reportsService } from './reports.service.js';

export class ReportsController {
  getSummary = async (req: Request, res: Response) => {
    const summary = await reportsService.getSummary();
    return res.status(200).json({ success: true, data: summary });
  };

  getSalesReport = async (req: Request, res: Response) => {
    const report = await reportsService.getSalesReport(req.query as any);
    return res.status(200).json({ success: true, data: report });
  };

  getCategoryReport = async (req: Request, res: Response) => {
    const report = await reportsService.getCategoryReport(req.query as any);
    return res.status(200).json({ success: true, data: report });
  };

  getDealerReport = async (req: Request, res: Response) => {
    const report = await reportsService.getDealerReport(req.query as any);
    return res.status(200).json({ success: true, data: report });
  };

  getInventoryReport = async (req: Request, res: Response) => {
    const report = await reportsService.getInventoryReport();
    return res.status(200).json({ success: true, data: report });
  };

  exportSalesCsv = async (req: Request, res: Response) => {
    const csv = await reportsService.exportSalesCsv(req.query as any);
    const filename = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  };

  exportDealersCsv = async (req: Request, res: Response) => {
    const csv = await reportsService.exportDealersCsv(req.query as any);
    const filename = `dealers_report_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  };

  exportInventoryCsv = async (req: Request, res: Response) => {
    const csv = await reportsService.exportInventoryCsv();
    const filename = `inventory_report_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  };
}

export const reportsController = new ReportsController();
