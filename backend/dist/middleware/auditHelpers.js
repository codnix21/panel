"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditReq = auditReq;
const audit_1 = require("../services/audit");
const clientIp_1 = require("../utils/clientIp");
function auditReq(req, action, resourceType, resourceId, details) {
    void (0, audit_1.logAudit)({
        userId: req.user?.userId,
        username: req.user?.username,
        action,
        resourceType: resourceType ?? null,
        resourceId: resourceId ?? null,
        details: details ?? null,
        ip: (0, clientIp_1.getClientIp)(req),
    });
}
//# sourceMappingURL=auditHelpers.js.map