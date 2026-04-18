export interface Node {
    id: number;
    name: string;
    ip: string;
    port: number;
    token: string;
    created_at: string;
}
export interface User {
    id: number;
    username: string;
    password_hash: string;
    created_at: string;
}
export interface JwtPayload {
    userId: number;
    username: string;
    /** Session version; must match users.token_version. */
    tv?: number;
}
