"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
const db_1 = require("../db");
async function logAudit(params) {
    try {
        await db_1.pool.query(`INSERT INTO audit_log (user_id, username, action, resource_type, resource_id, details, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
            params.userId ?? null,
            params.username ?? null,
            params.action,
            params.resourceType ?? null,
            params.resourceId ?? null,
            params.details ?? null,
            params.ip ?? null,
        ]);
    }
    catch (e) {
        console.error('audit log failed:', e);
    }
}
//# sourceMappingURL=audit.js.map