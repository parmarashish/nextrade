import { Response } from 'express';
import { dealersService } from './dealers.service.js';
import { extractRequestContext } from '../../auth/session.helper.js';
import { AuthenticatedRequest } from '../../common/types.js';

export class DealersController {
  // ─── Admin Endpoints ─────────────────────────────────────────

  listDealers = async (req: AuthenticatedRequest, res: Response) => {
    const result = await dealersService.listDealers(req.query as any);
    return res.status(200).json({ success: true, ...result });
  };

  getDealerById = async (req: AuthenticatedRequest, res: Response) => {
    const dealer = await dealersService.getDealerById(req.params.id);
    return res.status(200).json({ success: true, data: dealer });
  };

  approveDealer = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await dealersService.approveDealer(
      req.params.id,
      req.body,
      req.user!.id,
      ctx
    );
    return res.status(200).json({ success: true, ...result });
  };

  rejectDealer = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await dealersService.rejectDealer(
      req.params.id,
      req.body,
      req.user!.id,
      ctx
    );
    return res.status(200).json({ success: true, ...result });
  };

  updateDealerByAdmin = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const updated = await dealersService.updateDealerByAdmin(
      req.params.id,
      req.body,
      req.user!.id,
      ctx
    );
    return res.status(200).json({
      success: true,
      message: 'Dealer profile updated successfully',
      data: updated,
    });
  };

  deactivateDealer = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await dealersService.deactivateDealer(req.params.id, req.user!.id, ctx);
    return res.status(200).json({ success: true, ...result });
  };

  reactivateDealer = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await dealersService.reactivateDealer(req.params.id, req.user!.id, ctx);
    return res.status(200).json({ success: true, ...result });
  };

  // ─── Discount Matrix Endpoints ───────────────────────────────

  getDiscounts = async (req: AuthenticatedRequest, res: Response) => {
    const discounts = await dealersService.getDiscounts(req.params.id);
    return res.status(200).json({ success: true, data: discounts });
  };

  setDiscount = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const discount = await dealersService.setDiscount(
      req.params.id,
      req.body,
      req.user!.id,
      ctx
    );
    return res.status(200).json({
      success: true,
      message: 'Category discount configured successfully',
      data: discount,
    });
  };

  bulkSetDiscounts = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const results = await dealersService.bulkSetDiscounts(
      req.params.id,
      req.body,
      req.user!.id,
      ctx
    );
    return res.status(200).json({
      success: true,
      message: `Updated ${results.length} category discount(s)`,
      data: results,
    });
  };

  removeDiscount = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await dealersService.removeDiscount(
      req.params.id,
      req.params.categoryId,
      req.user!.id,
      ctx
    );
    return res.status(200).json({ success: true, ...result });
  };

  // ─── Dealer Self-Service Endpoints ───────────────────────────

  getMe = async (req: AuthenticatedRequest, res: Response) => {
    const profile = await dealersService.getDealerProfile(req.user!);
    return res.status(200).json({ success: true, data: profile });
  };

  updateMe = async (req: AuthenticatedRequest, res: Response) => {
    const updated = await dealersService.updateDealerSelf(req.user!.id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updated,
    });
  };
}

export const dealersController = new DealersController();
