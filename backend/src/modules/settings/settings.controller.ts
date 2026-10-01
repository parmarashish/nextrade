import { Request, Response } from 'express';
import { settingsService } from './settings.service.js';
import { AuthenticatedRequest } from '../../common/types.js';
import { extractRequestContext } from '../../auth/session.helper.js';
import { SettingKey } from './settings.dto.js';

export class SettingsController {
  getAll = async (req: AuthenticatedRequest, res: Response) => {
    const settings = await settingsService.getAll();
    return res.status(200).json({ success: true, data: settings });
  };

  getByKey = async (req: AuthenticatedRequest, res: Response) => {
    const setting = await settingsService.getByKey(req.params.key as SettingKey);
    return res.status(200).json({ success: true, data: setting });
  };

  updateSetting = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const updated = await settingsService.updateSetting(
      req.params.key as SettingKey,
      req.body,
      req.user!.id,
      ctx
    );

    return res.status(200).json({
      success: true,
      message: `Setting '${req.params.key}' updated successfully`,
      data: updated,
    });
  };

  initialize = async (req: AuthenticatedRequest, res: Response) => {
    const result = await settingsService.initializeDefaults();
    return res.status(200).json({ success: true, ...result });
  };

  getPublic = async (req: Request, res: Response) => {
    const publicSettings = await settingsService.getPublicSettings();
    return res.status(200).json({ success: true, data: publicSettings });
  };
}

export const settingsController = new SettingsController();
