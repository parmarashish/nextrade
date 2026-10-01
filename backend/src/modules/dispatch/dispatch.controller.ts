import { Response } from 'express';
import { dispatchService } from './dispatch.service.js';
import { extractRequestContext } from '../../auth/session.helper.js';
import { AuthenticatedRequest } from '../../common/types.js';

export class DispatchController {
  createDispatch = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await dispatchService.createDispatch(req.body, req.user!.id, ctx);
    return res.status(201).json({
      success: true,
      message: `Dispatch #${result.dispatch.dispatchNumber} created successfully`,
      data: result,
    });
  };

  findAll = async (req: AuthenticatedRequest, res: Response) => {
    const result = await dispatchService.findAll(req.query as any, req.user!);
    return res.status(200).json({ success: true, ...result });
  };

  findById = async (req: AuthenticatedRequest, res: Response) => {
    const dispatch = await dispatchService.findById(req.params.id, req.user!);
    return res.status(200).json({ success: true, data: dispatch });
  };

  updateTracking = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const dispatch = await dispatchService.updateTracking(
      req.params.id,
      req.body,
      req.user!.id,
      ctx
    );
    return res.status(200).json({
      success: true,
      message: 'Tracking details updated successfully',
      data: dispatch,
    });
  };

  deliverDispatch = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await dispatchService.deliverDispatch(req.params.id, req.user!.id, ctx);
    return res.status(200).json({
      success: true,
      ...result,
    });
  };
}

export const dispatchController = new DispatchController();
