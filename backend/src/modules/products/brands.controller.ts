import { Request, Response } from 'express';
import { brandsService } from './brands.service.js';
import { extractRequestContext } from '../../auth/session.helper.js';
import { AuthenticatedRequest } from '../../common/types.js';

export class BrandsController {
  findAll = async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const brands = await brandsService.findAll(includeInactive);
    return res.status(200).json({ success: true, data: brands });
  };

  findById = async (req: Request, res: Response) => {
    const brand = await brandsService.findById(req.params.id);
    return res.status(200).json({ success: true, data: brand });
  };

  create = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const brand = await brandsService.create(req.body, req.user!.id, ctx);
    return res.status(201).json({ success: true, message: 'Brand created successfully', data: brand });
  };

  update = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const brand = await brandsService.update(req.params.id, req.body, req.user!.id, ctx);
    return res.status(200).json({ success: true, message: 'Brand updated successfully', data: brand });
  };

  delete = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await brandsService.delete(req.params.id, req.user!.id, ctx);
    return res.status(200).json({ success: true, message: result.message });
  };
}

export const brandsController = new BrandsController();
