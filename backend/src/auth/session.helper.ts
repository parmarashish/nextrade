import crypto from 'crypto';
import { Request } from 'express';
import { RequestContext } from '../common/types.js';

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const generateSecureToken = (): string => {
  return crypto.randomBytes(40).toString('hex');
};

export const extractRequestContext = (req: Request): RequestContext => {
  const userAgent = req.headers['user-agent'] || 'Unknown Browser';
  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'Unknown IP';

  let deviceName = 'Desktop';
  if (/mobile/i.test(userAgent)) deviceName = 'Mobile Device';
  else if (/tablet|ipad/i.test(userAgent)) deviceName = 'Tablet';
  else if (/macintosh|mac os x/i.test(userAgent)) deviceName = 'Mac';
  else if (/windows/i.test(userAgent)) deviceName = 'Windows PC';
  else if (/linux/i.test(userAgent)) deviceName = 'Linux PC';

  return {
    userAgent,
    ipAddress,
    deviceName,
  };
};
