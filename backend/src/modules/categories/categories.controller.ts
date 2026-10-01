import { Request, Response } from 'express';
import { categoriesService } from './categories.service.js';
import { extractRequestContext } from '../../auth/session.helper.js';
import { AuthenticatedRequest } from '../../common/types.js';

export class CategoriesController {
  // ─── Get Category Tree ───────────────────────────────────────
  getTree = async (req: Request, res: Response) => {
    const tree = await categoriesService.getTree();
    return res.status(200).json({
      success: true,
      data: tree,
    });
  };

  // ─── Get Flat Categories List ────────────────────────────────
  getFlat = async (req: Request, res: Response) => {
    const result = await categoriesService.getFlat(req.query as any);
    return res.status(200).json({
      success: true,
      ...result,
    });
  };

  // ─── Get Single Category by ID ───────────────────────────────
  getById = async (req: Request, res: Response) => {
    const category = await categoriesService.getById(req.params.id);
    return res.status(200).json({
      success: true,
      data: category,
    });
  };

  // ─── Create Category (Admin Only) ────────────────────────────
  create = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const category = await categoriesService.create(req.body, req.user!.id, ctx);
    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  };

  // ─── Update Category (Admin Only) ────────────────────────────
  update = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const category = await categoriesService.update(
      req.params.id,
      req.body,
      req.user!.id,
      ctx
    );
    return res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: category,
    });
  };

  // ─── Delete Category (Admin Only) ────────────────────────────
  delete = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await categoriesService.delete(req.params.id, req.user!.id, ctx);
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  };
}

export const categoriesController = new CategoriesController();
