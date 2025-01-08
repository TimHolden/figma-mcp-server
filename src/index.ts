import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from 'zod';
import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import { ResourceContents } from '@modelcontextprotocol/sdk/types';

// Load environment variables
dotenv.config();

// Define Zod schemas for request parameters
function createSchema<T extends z.ZodRawShape>(method: string, schema: z.ZodObject<T>) {
  return z.object({
    method: z.literal(method),
    params: schema
  });
}

// File schemas
const fileGetSchema = createSchema("figma/files/get", z.object({
  fileId: z.string()
}));

const fileVariablesSchema = createSchema("figma/files/variables", z.object({
  fileId: z.string()
}));

const fileVariableCollectionsSchema = createSchema("figma/files/variable_collections", z.object({
  fileId: z.string()
}));

const resourceWatchSchema = createSchema("resources/watch", z.object({
  uri: z.string()
}));

const resourceCheckSchema = createSchema("resources/check", z.object({
  uri: z.string()
}));

const resourceListSchema = createSchema("resources/list", z.object({
  type: z.string().optional()
}));

interface ApiResponse {
  status: number;
  data: any;
  err?: string;
}

class FigmaAPIServer {
    private server: Server;
    private figmaToken: string;
    private baseURL: string = 'https://api.figma.com/v1';
    private watchedResources: Map<string, { lastModified: string }> = new Map();

    constructor(figmaToken: string) {
        if (!figmaToken) {
            throw new Error('FIGMA_ACCESS_TOKEN is required but not provided');
        }
        
        console.log(`Initializing server with token starting with: ${figmaToken.substring(0, 8)}...`);
        
        this.figmaToken = figmaToken;
        this.server = new Server({
            name: "figma-api-server",
            version: "1.0.0",
        }, {
            capabilities: {
                resources: {
                    subscribe: true,
                    listChanged: true,
                    list: true,
                    read: true,
                    watch: true
                },
                commands: {},
                events: {}
            }
        });

        this.initializeHandlers();
    }

    private async figmaRequest(method: string, endpoint: string, data?: any) {
        try {
            console.log(`Making Figma API request to: ${endpoint}`);
            
            // Changed to use only X-Figma-Token header
            const headers = {
                'X-Figma-Token': this.figmaToken,
                'Content-Type': 'application/json'
            };
            
            console.log('Request headers:', {
                ...headers,
                'X-Figma-Token': '[REDACTED]'
            });

            const response = await axios({
                method,
                url: `${this.baseURL}${endpoint}`,
                headers,
                data,
                validateStatus: (status: number) => status < 500
            });

            if (response.status === 403) {
                console.error('Authentication Error Details:', {
                    status: response.status,
                    data: response.data,
                    message: 'Figma API authentication failed. Please verify your access token and file permissions.'
                });
                throw new Error(`Figma API authentication failed: ${(response.data as ApiResponse)?.err || 'Unknown error'}`);
            }
            
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<ApiResponse>;
                console.error('Figma API error details:', {
                    endpoint,
                    status: axiosError.response?.status,
                    statusText: axiosError.response?.statusText,
                    data: axiosError.response?.data,
                    headers: axiosError.response?.headers
                });

                if (axiosError.response?.status === 403) {
                    console.error('Token being used:', this.figmaToken.substring(0, 8) + '...');
                    throw new Error(`Figma API authentication failed. Token: ${this.figmaToken.substring(0, 8)}...`);
                }
            }
            throw error;
        }
    }

    private parseFileId(uri: string): string | null {
        const match = uri.match(/figma:\/\/\/file\/([^\/]+)/);
        return match ? match[1] : null;
    }

    private initializeHandlers() {
        // Files API
        this.server.setRequestHandler(fileGetSchema, async (request) => {
            const { fileId } = request.params;
            return await this.figmaRequest('GET', `/files/${fileId}`);
        });

        // Variables API
        this.server.setRequestHandler(fileVariablesSchema, async (request) => {
            const { fileId } = request.params;
            return await this.figmaRequest('GET', `/files/${fileId}/variables`);
        });

        // Variable Collections API
        this.server.setRequestHandler(fileVariableCollectionsSchema, async (request) => {
            const { fileId } = request.params;
            return await this.figmaRequest('GET', `/files/${fileId}/variable_collections`);
        });

        // Resource Watch
        this.server.setRequestHandler(resourceWatchSchema, async (request) => {
            const { uri } = request.params;
            const fileId = this.parseFileId(uri);
            
            if (!fileId) {
                throw new Error('Invalid Figma resource URI');
            }

            try {
                const fileData = await this.figmaRequest('GET', `/files/${fileId}`);
                this.watchedResources.set(uri, {
                    lastModified: fileData.lastModified
                });

                return {
                    uri,
                    status: 'watching',
                    _meta: {}
                };
            } catch (error) {
                console.error('Error setting up watch:', error);
                throw error;
            }
        });

        // Resource Check
        this.server.setRequestHandler(resourceCheckSchema, async (request) => {
            const { uri } = request.params;
            const fileId = this.parseFileId(uri);
            
            if (!fileId) {
                throw new Error('Invalid Figma resource URI');
            }

            const watched = this.watchedResources.get(uri);
            if (!watched) {
                throw new Error('Resource not being watched');
            }

            try {
                const fileData = await this.figmaRequest('GET', `/files/${fileId}`);
                const changed = fileData.lastModified !== watched.lastModified;
                
                if (changed) {
                    this.watchedResources.set(uri, {
                        lastModified: fileData.lastModified
                    });
                }

                return {
                    uri,
                    changed,
                    timestamp: new Date().toISOString(),
                    _meta: {}
                };
            } catch (error) {
                console.error('Error checking for changes:', error);
                throw error;
            }
        });

        // Resource List
        this.server.setRequestHandler(resourceListSchema, async (request) => {
            return {
                tools: [{
                    name: "figma-file-watcher",
                    description: "Watches Figma files for changes",
                    inputSchema: {
                        type: "object",
                        properties: {
                            uri: { type: "string" }
                        }
                    }
                }],
                _meta: {}
            };
        });
    }

    public async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.log('Figma API Server started');
    }
}

// Start the server
async function main() {
    try {
        console.log('Starting Figma MCP server...');
        console.log('Environment variables loaded:', {
            FIGMA_ACCESS_TOKEN: process.env.FIGMA_ACCESS_TOKEN ? 'Present' : 'Missing',
            NODE_ENV: process.env.NODE_ENV
        });

        const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
        if (!figmaToken) {
            throw new Error('FIGMA_ACCESS_TOKEN environment variable is required');
        }

        const server = new FigmaAPIServer(figmaToken);
        await server.start();
    } catch (error) {
        console.error('Fatal error starting server:', error);
        process.exit(1);
    }
}

main().catch(console.error);