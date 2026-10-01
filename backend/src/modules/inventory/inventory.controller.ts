import { Response } from 'express';
import { inventoryService } from './inventory.service.js';
import { extractRequestContext } from '../../auth/session.helper.js';
import { AuthenticatedRequest } from '../../common/types.js';

export class InventoryController {
  getInventory = async (req: AuthenticatedRequest, res: Response) => {
    const result = await inventoryService.getInventory(req.query as any, req.user!.role);
    return res.status(200).json({ success: true, ...result });
  };

  getAlerts = async (req: AuthenticatedRequest, res: Response) => {
    const warehouseId = req.query.warehouseId as string | undefined;
    const alerts = await inventoryService.getAlerts(warehouseId);
    return res.status(200).json({ success: true, data: alerts });
  };

  adjustStock = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await inventoryService.adjustStock(req.body, req.user!.id, ctx);
    return res.status(200).json({
      success: true,
      message: 'Stock adjusted successfully',
      data: result,
    });
  };

  transferStock = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await inventoryService.transferStock(req.body, req.user!.id, ctx);
    return res.status(200).json({
      success: true,
      message: 'Stock transferred successfully',
      data: result,
    });
  };

  getMovements = async (req: AuthenticatedRequest, res: Response) => {
    const result = await inventoryService.getMovements(req.query as any);
    return res.status(200).json({ success: true, ...result });
  };
}

export const inventoryController = new InventoryController();
