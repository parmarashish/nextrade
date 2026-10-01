import { Response } from 'express';
import { warehousesService } from './warehouses.service.js';
import { extractRequestContext } from '../../auth/session.helper.js';
import { AuthenticatedRequest } from '../../common/types.js';

export class WarehousesController {
  findAll = async (req: AuthenticatedRequest, res: Response) => {
    const warehouses = await warehousesService.findAll(req.user!);
    return res.status(200).json({ success: true, data: warehouses });
  };

  findById = async (req: AuthenticatedRequest, res: Response) => {
    const warehouse = await warehousesService.findById(req.params.id);
    return res.status(200).json({ success: true, data: warehouse });
  };

  getSummary = async (req: AuthenticatedRequest, res: Response) => {
    const summary = await warehousesService.getSummary(req.params.id);
    return res.status(200).json({ success: true, data: summary });
  };

  create = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const warehouse = await warehousesService.create(req.body, req.user!.id, ctx);
    return res.status(201).json({
      success: true,
      message: 'Warehouse created successfully',
      data: warehouse,
    });
  };

  update = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const warehouse = await warehousesService.update(req.params.id, req.body, req.user!.id, ctx);
    return res.status(200).json({
      success: true,
      message: 'Warehouse updated successfully',
      data: warehouse,
    });
  };

  delete = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await warehousesService.delete(req.params.id, req.user!.id, ctx);
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  };
}

export const warehousesController = new WarehousesController();
