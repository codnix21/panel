export type NodeRow = {
    ip: string;
    port: number;
    token: string;
};
export declare function getNodeWithToken(nodeId: string): Promise<NodeRow | null>;
export declare function proxyToNode(node: NodeRow, method: string, path: string, body?: unknown): Promise<{
    status: number;
    data: any;
}>;
