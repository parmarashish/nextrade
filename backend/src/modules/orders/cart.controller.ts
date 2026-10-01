import { Response } from 'express';
import { cartService } from './cart.service.js';
import { AuthenticatedRequest } from '../../common/types.js';

export class CartController {
  getCart = async (req: AuthenticatedRequest, res: Response) => {
    const result = await cartService.getCart(req.user!);
    return res.status(200).json({ success: true, data: result });
  };

  addToCart = async (req: AuthenticatedRequest, res: Response) => {
    const item = await cartService.addToCart(req.user!.id, req.body);
    return res.status(201).json({
      success: true,
      message: 'Item added to cart',
      data: item,
    });
  };

  updateCartItem = async (req: AuthenticatedRequest, res: Response) => {
    const item = await cartService.updateCartItem(req.user!.id, req.params.itemId, req.body);
    return res.status(200).json({
      success: true,
      message: 'Cart item updated',
      data: item,
    });
  };

  removeFromCart = async (req: AuthenticatedRequest, res: Response) => {
    const result = await cartService.removeFromCart(req.user!.id, req.params.itemId);
    return res.status(200).json({ success: true, ...result });
  };

  clearCart = async (req: AuthenticatedRequest, res: Response) => {
    const result = await cartService.clearCart(req.user!.id);
    return res.status(200).json({ success: true, ...result });
  };
}

export const cartController = new CartController();
