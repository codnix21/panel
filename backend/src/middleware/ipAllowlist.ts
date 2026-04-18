import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { getClientIp, normalizeIp } from '../utils/clientIp';

export function ipAllowlistMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (config.allowedIps.length === 0) {
    next();
    return;
  }

  if (
    req.path === '/api/health' ||
    req.path === '/api/ready' ||
    req.originalUrl.startsWith('/api/health') ||
    req.originalUrl.startsWith('/api/ready')
  ) {
    next();
    return;
  }

  const ip = normalizeIp(getClientIp(req));
  const allowed = config.allowedIps.some((rule) => ip === normalizeIp(rule));

  if (!allowed) {
    res.status(403).json({ error: 'Forbidden: IP not allowed' });
    return;
  }

  next();
}
