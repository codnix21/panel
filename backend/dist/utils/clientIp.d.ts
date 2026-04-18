import { Request } from 'express';
export declare function normalizeIp(raw: string | undefined): string;
export declare function getClientIp(req: Request): string;
