"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const db_1 = require("../db");
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authorization required' });
        return;
    }
    const token = authHeader.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        const tv = payload.tv ?? 0;
        const r = await db_1.pool.query('SELECT token_version FROM users WHERE id = $1', [payload.userId]);
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
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
//# sourceMappingURL=auth.js.map