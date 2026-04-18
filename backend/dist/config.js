"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
function parseAllowedIps() {
    const raw = process.env.PANEL_ALLOWED_IPS || '';
    if (!raw.trim())
        return [];
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
const DEFAULT_JWT = 'change-me-in-production';
exports.config = {
    port: parseInt(process.env.PORT || '3000', 10),
    jwtSecret: process.env.JWT_SECRET || DEFAULT_JWT,
    jwtExpiresIn: 86400, // 24 hours in seconds
    /** When true, refuse to start with weak JWT_SECRET (production or REQUIRE_STRONG_SECRETS). */
    requireStrongSecrets: process.env.NODE_ENV === 'production' ||
        process.env.REQUIRE_STRONG_SECRETS === '1' ||
        process.env.REQUIRE_STRONG_SECRETS === 'true',
    loginRateLimitWindowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000', 10),
    loginRateLimitMax: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '30', 10),
    /** If true, X-Forwarded-For is trusted (set when panel is behind reverse proxy). */
    trustProxy: process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true',
    /** Comma-separated exact IPs allowed to call the API. Empty = allow all. Health is always allowed. */
    allowedIps: parseAllowedIps(),
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'mtproto_panel',
        user: process.env.DB_USER || 'mtproto',
        password: process.env.DB_PASSWORD || 'mtproto',
    },
    /** How often the panel pings nodes’ /api/health (ms). */
    healthPollIntervalMs: Math.max(5000, parseInt(process.env.HEALTH_POLL_INTERVAL_MS || '60000', 10)),
    /** If last_seen_at is older than this, UI may show “offline” / stale (ms). */
    healthStaleAfterMs: Math.max(10000, parseInt(process.env.HEALTH_STALE_AFTER_MS || '120000', 10)),
    /** Optional: POST JSON alerts (node down, batch partial failure). */
    notifyWebhookUrl: (process.env.NOTIFY_WEBHOOK_URL || '').trim() || undefined,
    telegramBotToken: (process.env.TELEGRAM_BOT_TOKEN || '').trim() || undefined,
    telegramChatId: (process.env.TELEGRAM_CHAT_ID || '').trim() || undefined,
    /**
     * Optional substring to match against node proxy image id/name from /api/info.
     * If set and a node’s image doesn’t include this, dashboard shows update hint.
     */
    expectedProxyImageRef: (process.env.EXPECTED_PROXY_IMAGE_REF || '').trim() || undefined,
    expectedNginxImageRef: (process.env.EXPECTED_NGINX_IMAGE_REF || '').trim() || undefined,
    /** Path to JSON file written by external backup cron: { "lastBackupAt": "ISO-8601" } */
    backupStatusFile: (process.env.BACKUP_STATUS_FILE || '').trim() || undefined,
};
//# sourceMappingURL=config.js.map