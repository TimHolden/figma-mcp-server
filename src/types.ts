import { ResourceContents } from '@modelcontextprotocol/sdk/types';

import { Tool } from '@modelcontextprotocol/sdk/types';

export interface ToolHandler {
    listTools(): Promise<Tool[]>;
    callTool(name: string, args: any): Promise<{
        content: Array<{
            type: string;
            text: string;
        }>;
    }>;
}

export interface ResourceHandler {
    list(): Promise<any[]>;
    read(uri: string): Promise<ResourceContents[]>;
    watch(uri: string): Promise<void>;
}

export interface FigmaResource {
    uri: string;
    type: string;
    name: string;
    metadata?: {
        lastModified?: string;
        thumbnailUrl?: string;
        version?: string;
        [key: string]: any;
    };
}

export interface FigmaFile {
    document: any;
    components: Record<string, any>;
    schemaVersion: number;
    styles: Record<string, any>;
    name: string;
    lastModified: string;
    thumbnailUrl: string;
    version: string;
    role: string;
}

export interface FigmaComponent {
    key: string;
    name: string;
    description: string;
    componentSetId?: string;
    documentationLinks?: string[];
}

export interface FigmaVariable {
    id: string;
    name: string;
    key: string;
    variableCollectionId: string;
    resolvedType: string;
    description?: string;
    hiddenFromPublishing?: boolean;
    scopes: string[];
}

export interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
}

export interface ServerOptions {
    port?: number;
    host?: string;
    sessionTimeout?: number;
    rateLimitRequests?: number;
    rateLimitWindow?: number;
}

export type ServerState = 'starting' | 'running' | 'stopping' | 'stopped' | 'error';

export interface ServerStats {
    status: ServerState;
    connections: number;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    sessions: number;
}