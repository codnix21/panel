"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeIp = normalizeIp;
exports.getClientIp = getClientIp;
const config_1 = require("../config");
function normalizeIp(raw) {
    if (!raw)
        return '';
    const t = raw.trim();
    if (t.startsWith('::ffff:'))
        return t.slice(7);
    return t;
}
function getClientIp(req) {
    if (config_1.config.trustProxy && typeof req.headers['x-forwarded-for'] === 'string') {
        const first = req.headers['x-forwarded-for'].split(',')[0]?.trim();
        if (first)
            return normalizeIp(first);
    }
    return normalizeIp(req.ip) || normalizeIp(req.socket?.remoteAddress);
}
//# sourceMappingURL=clientIp.js.map