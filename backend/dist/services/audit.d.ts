export declare function logAudit(params: {
    userId?: number | null;
    username?: string | null;
    action: string;
    resourceType?: string | null;
    resourceId?: string | null;
    details?: Record<string, unknown> | null;
    ip?: string | null;
}): Promise<void>;
