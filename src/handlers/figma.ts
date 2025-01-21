import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { LRUCache } from 'lru-cache';
import { z } from 'zod';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

interface FigmaApiCallStats {
    lastApiCallTime: number;
    totalApiCalls: number;
    failedApiCalls: number;
    rateLimitRemaining: number | null;
    rateLimitReset: number | null;
    apiResponseTimes: number[];
    lastError?: {
        time: number;
        message: string;
        endpoint: string;
    };
}

interface FigmaError {
    message: string;
    status?: number;
    endpoint?: string;
}

type StatsCallback = (stats: Partial<FigmaApiCallStats>) => void;

export class FigmaHandler {
    protected cache: LRUCache<string, any>;
    protected figmaToken: string;
    protected statsCallback?: StatsCallback;
    protected rateLimitRemaining: number | null = null;
    protected rateLimitReset: number | null = null;

    constructor(figmaToken: string, statsCallback?: StatsCallback) {
        this.figmaToken = figmaToken;
        this.statsCallback = statsCallback;
        this.cache = new LRUCache({
            max: 500,
            ttl: 1000 * 60 * 5 // 5 minutes
        });
    }

    private updateStats(stats: Partial<FigmaApiCallStats>) {
        if (this.statsCallback) {
            this.statsCallback(stats);
        }
    }

    private async makeFigmaRequest(endpoint: string): Promise<any> {
        const startTime = Date.now();
        let responseTime: number;

        try {
            const response = await fetch(`https://api.figma.com/v1${endpoint}`, {
                headers: {
                    'X-Figma-Token': this.figmaToken
                }
            });
            
            responseTime = Date.now() - startTime;
            
            // Update rate limit info
            this.rateLimitRemaining = Number(response.headers.get('x-rate-limit-remaining')) || null;
            const resetTime = response.headers.get('x-rate-limit-reset');
            this.rateLimitReset = resetTime ? Number(new Date(resetTime)) : null;
            
            if (!response.ok) {
                throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            // Update stats for successful request
            this.updateStats({
                lastApiCallTime: Date.now(),
                totalApiCalls: 1,
                apiResponseTimes: [responseTime],
                rateLimitRemaining: this.rateLimitRemaining,
                rateLimitReset: this.rateLimitReset
            });

            return data;
        } catch (error) {
            // Update stats for failed request
            responseTime = Date.now() - startTime;
            this.updateStats({
                lastApiCallTime: Date.now(),
                totalApiCalls: 1,
                failedApiCalls: 1,
                apiResponseTimes: [responseTime],
                rateLimitRemaining: this.rateLimitRemaining,
                rateLimitReset: this.rateLimitReset,
                lastError: {
                    time: Date.now(),
                    message: error instanceof Error ? error.message : 'Unknown error',
                    endpoint
                }
            });
            throw error;
        }
    }

    async listTools() {
        return [
            {
                name: "get-file",
                description: "Get details of a Figma file",
                inputSchema: {
                    type: "object",
                    properties: {
                        fileKey: {
                            type: "string",
                            description: "The Figma file key"
                        }
                    },
                    required: ["fileKey"]
                }
            },
            {
                name: "list-files",
                description: "List files in a Figma project",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectId: {
                            type: "string",
                            description: "The Figma project ID"
                        }
                    },
                    required: ["projectId"]
                }
            }
        ];
    }

    async callTool(name: string, args: unknown) {
        try {
            switch (name) {
                case "get-file":
                    return await this.getFigmaFile(args);
                case "list-files":
                    return await this.listFigmaFiles(args);
                default:
                    return {
                        isError: true,
                        content: [{
                            type: "text",
                            text: `Unknown tool: ${name}`
                        }]
                    };
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: `Invalid arguments: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
                    }]
                };
            }

            const errMsg = error instanceof Error ? error.message : 'Unknown error occurred';
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: `Tool execution failed: ${errMsg}`
                }]
            };
        }
    }

    async getFigmaFile(args: unknown) {
        const schema = z.object({
            fileKey: z.string()
        });
        
        const { fileKey } = schema.parse(args);
        const cacheKey = `file:${fileKey}`;
        
        let fileData = this.cache.get(cacheKey);
        if (!fileData) {
            fileData = await this.makeFigmaRequest(`/files/${fileKey}`);
            this.cache.set(cacheKey, fileData);
        }
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify(fileData, null, 2)
            }]
        };
    }

    async listFigmaFiles(args: unknown) {
        const schema = z.object({
            projectId: z.string()
        });
        
        const { projectId } = schema.parse(args);
        const cacheKey = `project:${projectId}`;
        
        let filesData = this.cache.get(cacheKey);
        if (!filesData) {
            filesData = await this.makeFigmaRequest(`/projects/${projectId}/files`);
            this.cache.set(cacheKey, filesData);
        }
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify(filesData, null, 2)
            }]
        };
    }
}