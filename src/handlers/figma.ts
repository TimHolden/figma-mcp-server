import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { LRUCache } from 'lru-cache';
import { z } from 'zod';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

interface FigmaError {
    message: string;
    errors?: Array<{
        path: string[];
        message: string;
    }>;
}

export class FigmaHandler {
    protected cache: LRUCache<string, any>;
    protected figmaToken: string;

    constructor(figmaToken: string) {
        this.figmaToken = figmaToken;
        this.cache = new LRUCache({
            max: 500,
            ttl: 1000 * 60 * 5 // 5 minutes
        });
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
                        text: `Invalid arguments: ${(error as z.ZodError).errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
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
            try {
                const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
                    headers: {
                        'X-Figma-Token': this.figmaToken
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Figma API error: ${response.statusText}`);
                }
                
                fileData = await response.json();
                this.cache.set(cacheKey, fileData);
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : 'Unknown error occurred';
                throw new Error(`Failed to fetch from Figma API: ${errMsg}`);
            }
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
            try {
                const response = await fetch(`https://api.figma.com/v1/projects/${projectId}/files`, {
                    headers: {
                        'X-Figma-Token': this.figmaToken
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Figma API error: ${response.statusText}`);
                }
                
                filesData = await response.json();
                this.cache.set(cacheKey, filesData);
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : 'Unknown error occurred';
                throw new Error(`Failed to read Figma resource: ${errMsg}`);
            }
        }
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify(filesData, null, 2)
            }]
        };
    }
}