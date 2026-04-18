import { Request } from 'express';
import { config } from '../config';

export function normalizeIp(raw: string | undefined): string {
  if (!raw) return '';
  const t = raw.trim();
  if (t.startsWith('::ffff:')) return t.slice(7);
  return t;
}

export function getClientIp(req: Request): string {
  if (config.trustProxy && typeof req.headers['x-forwarded-for'] === 'string') {
    const first = req.headers['x-forwarded-for'].split(',')[0]?.trim();
    if (first) return normalizeIp(first);
  }
  return normalizeIp(req.ip) || normalizeIp(req.socket?.remoteAddress);
}
