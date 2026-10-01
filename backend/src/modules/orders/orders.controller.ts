import { Response } from 'express';
import { ordersService } from './orders.service.js';
import { extractRequestContext } from '../../auth/session.helper.js';
import { AuthenticatedRequest } from '../../common/types.js';

export class OrdersController {
  checkout = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const order = await ordersService.checkout(req.user!, req.body, ctx);
    return res.status(201).json({
      success: true,
      message: `Order #${order.orderNumber} placed successfully`,
      data: order,
    });
  };

  findAll = async (req: AuthenticatedRequest, res: Response) => {
    const result = await ordersService.findAll(req.query as any, req.user!);
    return res.status(200).json({ success: true, ...result });
  };

  findById = async (req: AuthenticatedRequest, res: Response) => {
    const order = await ordersService.findById(req.params.id, req.user!);
    return res.status(200).json({ success: true, data: order });
  };

  confirmOrder = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const order = await ordersService.confirmOrder(req.params.id, req.user!.id, ctx);
    return res.status(200).json({
      success: true,
      message: `Order #${order.orderNumber} confirmed`,
      data: order,
    });
  };

  cancelOrder = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const order = await ordersService.cancelOrder(req.params.id, req.user!.id, ctx, req.user!.role);
    return res.status(200).json({
      success: true,
      message: `Order #${order.orderNumber} cancelled. Reserved stock released and credit limit restored.`,
      data: order,
    });
  };

  addPayment = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const payment = await ordersService.addPayment(req.params.id, req.body, req.user!, ctx);
    return res.status(201).json({
      success: true,
      message: 'Payment record submitted successfully',
      data: payment,
    });
  };
}

export const ordersController = new OrdersController();
