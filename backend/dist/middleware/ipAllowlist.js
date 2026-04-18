"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipAllowlistMiddleware = ipAllowlistMiddleware;
const config_1 = require("../config");
const clientIp_1 = require("../utils/clientIp");
function ipAllowlistMiddleware(req, res, next) {
    if (config_1.config.allowedIps.length === 0) {
        next();
        return;
    }
    if (req.path === '/api/health' ||
        req.path === '/api/ready' ||
        req.originalUrl.startsWith('/api/health') ||
        req.originalUrl.startsWith('/api/ready')) {
        next();
        return;
    }
    const ip = (0, clientIp_1.normalizeIp)((0, clientIp_1.getClientIp)(req));
    const allowed = config_1.config.allowedIps.some((rule) => ip === (0, clientIp_1.normalizeIp)(rule));
    if (!allowed) {
        res.status(403).json({ error: 'Forbidden: IP not allowed' });
        return;
    }
    next();
}
//# sourceMappingURL=ipAllowlist.js.map