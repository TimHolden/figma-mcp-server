import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ResourceContents } from "@modelcontextprotocol/sdk/types";

export type ServerState = 
  | 'initializing' 
  | 'initialized' 
  | 'running' 
  | 'error' 
  | 'stopping' 
  | 'stopped' 
  | 'closed';

export interface ServerConfig {
  name: string;
  version: string;
  capabilities: {
    resources: {
      subscribe: boolean;
      listChanged: boolean;
      list: boolean;
      read: boolean;
      watch: boolean;
    };
    commands: {
      [key: string]: boolean;
    };
    events: Record<string, unknown>;
  };
}

export interface MCPRequest {
  method: string;
  params: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

export interface SessionInfo {
  transport: SSEServerTransport;
  lastSeen: number;
  messageCount: number;
}

export interface FigmaFile {
  key: string;
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
}

export interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  fileKey: string;
  nodeId: string;
}

export interface FigmaVariable {
  id: string;
  name: string;
  description: string;
  fileKey: string;
  resolvedType: string;
  valuesByMode: Record<string, unknown>;
}

export interface FigmaResource {
  uri: string;
  type: 'file' | 'component' | 'variable';
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ResourceHandler {
  list: () => Promise<FigmaResource[]>;
  read: (uri: string) => Promise<ResourceContents[]>;
  watch?: (uri: string) => Promise<void>;
  search?: (query: string) => Promise<FigmaResource[]>;
}

export interface DebugInfo {
  state: ServerState;
  startTime: number;
  uptime: number;
  processUptime: number;
  activeConnections: string[];
  connectionAttempts: Record<string, number>;
  sessionCount: number;
  lastError: Error | null;
  recentLogs: string[];
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
}

export interface Health {
  status: 'healthy' | 'unhealthy';
  activeConnections: number;
  timestamp: string;
  version: string;
  capabilities: {
    commands: Record<string, boolean>;
  };
}