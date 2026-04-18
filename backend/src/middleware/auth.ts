import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../db';
import { JwtPayload } from '../types';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const tv = payload.tv ?? 0;
    const r = await pool.query('SELECT token_version FROM users WHERE id = $1', [payload.userId]);
    if (r.rows.length === 0) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    const dbTv = Number(r.rows[0].token_version) || 0;
    if (dbTv !== tv) {
      res.status(401).json({ error: 'Session revoked' });
      return;
    }
    req.user = { userId: payload.userId, username: payload.username, tv: dbTv };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
