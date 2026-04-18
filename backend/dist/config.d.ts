export declare const config: {
    port: number;
    jwtSecret: string;
    jwtExpiresIn: number;
    /** When true, refuse to start with weak JWT_SECRET (production or REQUIRE_STRONG_SECRETS). */
    requireStrongSecrets: boolean;
    loginRateLimitWindowMs: number;
    loginRateLimitMax: number;
    /** If true, X-Forwarded-For is trusted (set when panel is behind reverse proxy). */
    trustProxy: boolean;
    /** Comma-separated exact IPs allowed to call the API. Empty = allow all. Health is always allowed. */
    allowedIps: string[];
    db: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
    };
    /** How often the panel pings nodes’ /api/health (ms). */
    healthPollIntervalMs: number;
    /** If last_seen_at is older than this, UI may show “offline” / stale (ms). */
    healthStaleAfterMs: number;
    /** Optional: POST JSON alerts (node down, batch partial failure). */
    notifyWebhookUrl: string | undefined;
    telegramBotToken: string | undefined;
    telegramChatId: string | undefined;
    /**
     * Optional substring to match against node proxy image id/name from /api/info.
     * If set and a node’s image doesn’t include this, dashboard shows update hint.
     */
    expectedProxyImageRef: string | undefined;
    expectedNginxImageRef: string | undefined;
    /** Path to JSON file written by external backup cron: { "lastBackupAt": "ISO-8601" } */
    backupStatusFile: string | undefined;
};
