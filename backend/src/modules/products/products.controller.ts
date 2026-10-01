import { Response } from 'express';
import { productsService } from './products.service.js';
import { extractRequestContext } from '../../auth/session.helper.js';
import { AuthenticatedRequest } from '../../common/types.js';

export class ProductsController {
  findAll = async (req: AuthenticatedRequest, res: Response) => {
    const result = await productsService.findAll(req.query as any, req.user);
    return res.status(200).json({ success: true, ...result });
  };

  findById = async (req: AuthenticatedRequest, res: Response) => {
    const product = await productsService.findById(req.params.id, req.user);
    return res.status(200).json({ success: true, data: product });
  };

  create = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const product = await productsService.create(req.body, req.user!.id, ctx);
    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  };

  update = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const product = await productsService.update(req.params.id, req.body, req.user!.id, ctx);
    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    });
  };

  delete = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await productsService.delete(req.params.id, req.user!.id, ctx);
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  };

  addVariant = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const variant = await productsService.addVariant(req.params.id, req.body, req.user!.id, ctx);
    return res.status(201).json({
      success: true,
      message: 'Variant added successfully',
      data: variant,
    });
  };

  updateVariant = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const variant = await productsService.updateVariant(
      req.params.id,
      req.params.variantId,
      req.body,
      req.user!.id,
      ctx
    );
    return res.status(200).json({
      success: true,
      message: 'Variant updated successfully',
      data: variant,
    });
  };

  deleteVariant = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await productsService.deleteVariant(
      req.params.id,
      req.params.variantId,
      req.user!.id,
      ctx
    );
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  };
}

export const productsController = new ProductsController();
