import { Router, Response, Request } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { pool } from '../db';
import { config } from '../config';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { getClientIp } from '../utils/clientIp';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: Math.max(config.loginRateLimitWindowMs, 1000),
  max: Math.max(config.loginRateLimitMax, 1),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Подождите и попробуйте снова.' },
  keyGenerator: (req) => getClientIp(req) || req.ip || 'unknown',
});

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      await logAudit({
        username,
        action: 'auth.login_failed',
        resourceType: 'user',
        resourceId: username,
        ip: getClientIp(req),
      });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await logAudit({
        username,
        action: 'auth.login_failed',
        resourceType: 'user',
        resourceId: username,
        ip: getClientIp(req),
      });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: String(user.id),
      ip: getClientIp(req),
    });

    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
