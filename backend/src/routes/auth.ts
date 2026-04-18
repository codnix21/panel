import { Router, Response, Request } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { pool } from '../db';
import { config } from '../config';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { auditReq } from '../middleware/auditHelpers';
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
  const { username, password, totp } = req.body;

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

    if (user.totp_enabled) {
      if (!totp || typeof totp !== 'string') {
        res.status(401).json({ error: 'totp_required' });
        return;
      }
      const vr = verifySync({
        secret: user.totp_secret,
        token: totp.trim().replace(/\s/g, ''),
      });
      if (!user.totp_secret || !vr.valid) {
        await logAudit({
          username,
          action: 'auth.login_failed',
          resourceType: 'user',
          resourceId: username,
          ip: getClientIp(req),
        });
        res.status(401).json({ error: 'Invalid TOTP code' });
        return;
      }
    }

    const tv = Number(user.token_version) || 0;
    const token = jwt.sign(
      { userId: user.id, username: user.username, tv },
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

    res.json({ token, user: { userId: user.id, username: user.username } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const r = await pool.query('SELECT totp_enabled FROM users WHERE id = $1', [req.user!.userId]);
  res.json({ user: req.user, totpEnabled: r.rows[0]?.totp_enabled === true });
});

router.post('/totp/setup', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const secret = generateSecret();
    await pool.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret, req.user!.userId]);
    const otpauthUri = generateURI({
      issuer: 'MTProto Panel',
      label: req.user!.username,
      secret,
    });
    res.json({ secret, otpauthUri });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/totp/enable', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body as { code?: string };
    const r = await pool.query('SELECT totp_secret FROM users WHERE id = $1', [req.user!.userId]);
    const sec = r.rows[0]?.totp_secret as string | undefined;
    if (!sec || !code) {
      res.status(400).json({ error: 'Invalid code' });
      return;
    }
    const vr = verifySync({ secret: sec, token: String(code).trim().replace(/\s/g, '') });
    if (!vr.valid) {
      res.status(400).json({ error: 'Invalid code' });
      return;
    }
    await pool.query('UPDATE users SET totp_enabled = TRUE WHERE id = $1', [req.user!.userId]);
    auditReq(req, 'auth.totp_enable', 'user', String(req.user!.userId), {});
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/revoke-sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body as { password?: string };
    if (!password) {
      res.status(400).json({ error: 'password required' });
      return;
    }
    const r = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user!.userId]);
    if (r.rows.length === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const valid = await bcrypt.compare(password, r.rows[0].password_hash);
    if (!valid) {
      res.status(400).json({ error: 'Invalid password' });
      return;
    }
    await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [req.user!.userId]);
    auditReq(req, 'auth.revoke_sessions', 'user', String(req.user!.userId), {});
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/totp/disable', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body as { password?: string };
    if (!password) {
      res.status(400).json({ error: 'password required' });
      return;
    }
    const r = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user!.userId]);
    const valid = await bcrypt.compare(password, r.rows[0].password_hash);
    if (!valid) {
      res.status(400).json({ error: 'Invalid password' });
      return;
    }
    await pool.query('UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = $1', [req.user!.userId]);
    auditReq(req, 'auth.totp_disable', 'user', String(req.user!.userId), {});
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
