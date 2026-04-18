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
};
