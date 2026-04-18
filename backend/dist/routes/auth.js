"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const otplib_1 = require("otplib");
const db_1 = require("../db");
const config_1 = require("../config");
const auth_1 = require("../middleware/auth");
const auditHelpers_1 = require("../middleware/auditHelpers");
const audit_1 = require("../services/audit");
const clientIp_1 = require("../utils/clientIp");
const router = (0, express_1.Router)();
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: Math.max(config_1.config.loginRateLimitWindowMs, 1000),
    max: Math.max(config_1.config.loginRateLimitMax, 1),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Слишком много попыток входа. Подождите и попробуйте снова.' },
    keyGenerator: (req) => (0, clientIp_1.getClientIp)(req) || req.ip || 'unknown',
});
router.post('/login', loginLimiter, async (req, res) => {
    const { username, password, totp } = req.body;
    if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
    }
    try {
        const result = await db_1.pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            await (0, audit_1.logAudit)({
                username,
                action: 'auth.login_failed',
                resourceType: 'user',
                resourceId: username,
                ip: (0, clientIp_1.getClientIp)(req),
            });
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const user = result.rows[0];
        const valid = await bcrypt_1.default.compare(password, user.password_hash);
        if (!valid) {
            await (0, audit_1.logAudit)({
                username,
                action: 'auth.login_failed',
                resourceType: 'user',
                resourceId: username,
                ip: (0, clientIp_1.getClientIp)(req),
            });
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        if (user.totp_enabled) {
            if (!totp || typeof totp !== 'string') {
                res.status(401).json({ error: 'totp_required' });
                return;
            }
            const vr = (0, otplib_1.verifySync)({
                secret: user.totp_secret,
                token: totp.trim().replace(/\s/g, ''),
            });
            if (!user.totp_secret || !vr.valid) {
                await (0, audit_1.logAudit)({
                    username,
                    action: 'auth.login_failed',
                    resourceType: 'user',
                    resourceId: username,
                    ip: (0, clientIp_1.getClientIp)(req),
                });
                res.status(401).json({ error: 'Invalid TOTP code' });
                return;
            }
        }
        const tv = Number(user.token_version) || 0;
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username, tv }, config_1.config.jwtSecret, { expiresIn: config_1.config.jwtExpiresIn });
        await (0, audit_1.logAudit)({
            userId: user.id,
            username: user.username,
            action: 'auth.login',
            resourceType: 'user',
            resourceId: String(user.id),
            ip: (0, clientIp_1.getClientIp)(req),
        });
        res.json({ token, user: { userId: user.id, username: user.username } });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/me', auth_1.authMiddleware, async (req, res) => {
    const r = await db_1.pool.query('SELECT totp_enabled FROM users WHERE id = $1', [req.user.userId]);
    res.json({ user: req.user, totpEnabled: r.rows[0]?.totp_enabled === true });
});
router.post('/totp/setup', auth_1.authMiddleware, async (req, res) => {
    try {
        const secret = (0, otplib_1.generateSecret)();
        await db_1.pool.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret, req.user.userId]);
        const otpauthUri = (0, otplib_1.generateURI)({
            issuer: 'MTProto Panel',
            label: req.user.username,
            secret,
        });
        res.json({ secret, otpauthUri });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/totp/enable', auth_1.authMiddleware, async (req, res) => {
    try {
        const { code } = req.body;
        const r = await db_1.pool.query('SELECT totp_secret FROM users WHERE id = $1', [req.user.userId]);
        const sec = r.rows[0]?.totp_secret;
        if (!sec || !code) {
            res.status(400).json({ error: 'Invalid code' });
            return;
        }
        const vr = (0, otplib_1.verifySync)({ secret: sec, token: String(code).trim().replace(/\s/g, '') });
        if (!vr.valid) {
            res.status(400).json({ error: 'Invalid code' });
            return;
        }
        await db_1.pool.query('UPDATE users SET totp_enabled = TRUE WHERE id = $1', [req.user.userId]);
        (0, auditHelpers_1.auditReq)(req, 'auth.totp_enable', 'user', String(req.user.userId), {});
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/revoke-sessions', auth_1.authMiddleware, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            res.status(400).json({ error: 'password required' });
            return;
        }
        const r = await db_1.pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.userId]);
        if (r.rows.length === 0) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const valid = await bcrypt_1.default.compare(password, r.rows[0].password_hash);
        if (!valid) {
            res.status(400).json({ error: 'Invalid password' });
            return;
        }
        await db_1.pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [req.user.userId]);
        (0, auditHelpers_1.auditReq)(req, 'auth.revoke_sessions', 'user', String(req.user.userId), {});
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/totp/disable', auth_1.authMiddleware, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            res.status(400).json({ error: 'password required' });
            return;
        }
        const r = await db_1.pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.userId]);
        const valid = await bcrypt_1.default.compare(password, r.rows[0].password_hash);
        if (!valid) {
            res.status(400).json({ error: 'Invalid password' });
            return;
        }
        await db_1.pool.query('UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = $1', [req.user.userId]);
        (0, auditHelpers_1.auditReq)(req, 'auth.totp_disable', 'user', String(req.user.userId), {});
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map