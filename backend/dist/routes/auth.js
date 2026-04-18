"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const db_1 = require("../db");
const config_1 = require("../config");
const auth_1 = require("../middleware/auth");
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
    const { username, password } = req.body;
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
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username }, config_1.config.jwtSecret, { expiresIn: config_1.config.jwtExpiresIn });
        await (0, audit_1.logAudit)({
            userId: user.id,
            username: user.username,
            action: 'auth.login',
            resourceType: 'user',
            resourceId: String(user.id),
            ip: (0, clientIp_1.getClientIp)(req),
        });
        res.json({ token, user: { id: user.id, username: user.username } });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/me', auth_1.authMiddleware, async (req, res) => {
    res.json({ user: req.user });
});
exports.default = router;
//# sourceMappingURL=auth.js.map