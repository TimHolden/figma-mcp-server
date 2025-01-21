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

interface VariableReference {
    sourceId: string;
    targetId: string;
    expression: string;
}

interface ReferenceValidation {
    isValid: boolean;
    errors: Array<{
        variableId: string;
        error: string;
    }>;
    dependencies: Map<string, string[]>;
}

interface ThemeMode {
    name: string;
    variables: Array<{
        variableId: string;
        value: string;
    }>;
}

interface ThemeConfig {
    name: string;
    modes: ThemeMode[];
}

interface FigmaVariable {
    name: string;
    type: 'COLOR' | 'FLOAT' | 'STRING';
    value: string;
    scope: 'LOCAL' | 'ALL_FRAMES';
    description?: string;
}

interface VariableUpdate {
    variableId: string;
    value: string;
    description?: string;
}

interface CreateVariablesResponse {
    id: string;
    name: string;
    variables: Array<{
        id: string;
        name: string;
        resolvedType: string;
    }>;
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

    private async makeFigmaRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
        const startTime = Date.now();
        let responseTime: number;

        try {
            const response = await fetch(`https://api.figma.com/v1${endpoint}`, {
                headers: {
                    'X-Figma-Token': this.figmaToken,
                    'Content-Type': 'application/json'
                },
                ...options
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
                case "create_reference":
                    return await this.createReference(args);
                case "validate_references":
                    return await this.validateReferences(args);
                case "create_theme":
                    return await this.createTheme(args);
                case "delete_variables":
                    return await this.deleteVariables(args);
                case "update_variables":
                    return await this.updateVariables(args);
                case "create_variables":
                    return await this.createVariables(args);
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
        
        try {
            let fileData = this.cache.get(cacheKey);
            if (!fileData) {
                fileData = await this.makeFigmaRequest(`/files/${fileKey}`);
                this.cache.set(cacheKey, fileData);
            }

            // Format the file data in a more readable way
            const formattedData = {
                name: fileData.name,
                lastModified: fileData.lastModified,
                version: fileData.version,
                editorType: fileData.editorType,
                documentKey: fileData.documentKey,
                nodes: Object.keys(fileData.document?.children || {}).length + ' nodes',
                components: Object.keys(fileData.components || {}).length + ' components',
                styles: Object.keys(fileData.styles || {}).length + ' styles'
            };
            
            return {
                content: [{
                    type: "text",
                    text: `File details for: ${fileData.name}\n\n${Object.entries(formattedData)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join('\n')}`
                }]
            };
        } catch (error) {
            let errorMessage = 'Failed to retrieve Figma file';
            if (error instanceof Error) {
                if (error.message.includes('404')) {
                    errorMessage = `File not found: ${fileKey}. Please verify the file key is correct.`;
                } else if (error.message.includes('403')) {
                    errorMessage = 'Access denied. Please verify your Figma access token has the correct permissions.';
                } else {
                    errorMessage = `Error accessing file: ${error.message}`;
                }
            }
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: errorMessage
                }]
            };
        }
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

    async createVariables(args: unknown) {
        const { CreateVariablesSchema } = require('./figma-tools');
        const { fileKey, variables } = CreateVariablesSchema.parse(args);

        try {
            // Create a collection if it doesn't exist
            const collection = await this.makeFigmaRequest(`/files/${fileKey}/variables/create-collection`, {
                method: 'POST',
                body: JSON.stringify({
                    name: "MCP Generated Variables",
                    variableTypes: [...new Set(variables.map((v: FigmaVariable) => v.type))]
                })
            });

            // Create variables in the collection
            const createdVariables = await this.makeFigmaRequest(`/files/${fileKey}/variables`, {
                method: 'POST',
                body: JSON.stringify({
                    variableCollectionId: collection.id,
                    variables: variables.map((v: FigmaVariable) => ({
                        name: v.name,
                        resolvedType: v.type,
                        description: v.description,
                        value: v.value,
                        scope: v.scope
                    }))
                })
            });

            return {
                content: [{
                    type: "text",
                    text: `Successfully created ${variables.length} variables:\n${
                        variables.map((v: FigmaVariable) => `- ${v.name} (${v.type})`).join('\n')
                    }`
                }]
            };
        } catch (error) {
            let errorMessage = 'Failed to create variables';
            if (error instanceof Error) {
                if (error.message.includes('404')) {
                    errorMessage = `File not found: ${fileKey}`;
                } else if (error.message.includes('403')) {
                    errorMessage = 'Access denied. Please verify your Figma access token has write permissions.';
                } else {
                    errorMessage = `Error creating variables: ${error.message}`;
                }
            }
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: errorMessage
                }]
            };
        }
    }

    async updateVariables(args: unknown) {
        const { UpdateVariablesSchema } = require('./figma-tools');
        const { fileKey, updates } = UpdateVariablesSchema.parse(args);

        try {
            // Get existing variables to validate updates
            const variables = await this.makeFigmaRequest(`/files/${fileKey}/variables`);
            
            // Process updates
            const results = await Promise.all(
                updates.map(async (update: VariableUpdate) => {
                    const variable = variables.find((v: any) => v.id === update.variableId);
                    if (!variable) {
                        return `Variable ${update.variableId} not found`;
                    }

                    try {
                        await this.makeFigmaRequest(`/files/${fileKey}/variables/${update.variableId}`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                                value: update.value,
                                ...(update.description && { description: update.description })
                            })
                        });
                        return `Updated ${variable.name}`;
                    } catch (error) {
                        return `Failed to update ${variable.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    }
                })
            );

            return {
                content: [{
                    type: "text",
                    text: `Variable update results:\n${results.map(r => `- ${r}`).join('\n')}`
                }]
            };
        } catch (error) {
            let errorMessage = 'Failed to update variables';
            if (error instanceof Error) {
                if (error.message.includes('404')) {
                    errorMessage = `File not found: ${fileKey}`;
                } else if (error.message.includes('403')) {
                    errorMessage = 'Access denied. Please verify your Figma access token has write permissions.';
                } else {
                    errorMessage = `Error updating variables: ${error.message}`;
                }
            }
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: errorMessage
                }]
            };
        }
    }

    async deleteVariables(args: unknown) {
        const { DeleteVariablesSchema } = require('./figma-tools');
        const { fileKey, variableIds, softDelete } = DeleteVariablesSchema.parse(args);

        try {
            // Get existing variables to validate deletions
            const variables = await this.makeFigmaRequest(`/files/${fileKey}/variables`);
            
            // Process deletions
            const results = await Promise.all(
                variableIds.map(async (id: string) => {
                    const variable = variables.find((v: any) => v.id === id);
                    if (!variable) {
                        return `Variable ${id} not found`;
                    }

                    try {
                        await this.makeFigmaRequest(`/files/${fileKey}/variables/${id}`, {
                            method: 'DELETE',
                            body: JSON.stringify({ softDelete })
                        });
                        return `Deleted ${variable.name}${softDelete ? ' (soft delete)' : ''}`;
                    } catch (error) {
                        return `Failed to delete ${variable.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    }
                })
            );

            return {
                content: [{
                    type: "text",
                    text: `Variable deletion results:\n${results.map(r => `- ${r}`).join('\n')}`
                }]
            };
        } catch (error) {
            let errorMessage = 'Failed to delete variables';
            if (error instanceof Error) {
                if (error.message.includes('404')) {
                    errorMessage = `File not found: ${fileKey}`;
                } else if (error.message.includes('403')) {
                    errorMessage = 'Access denied. Please verify your Figma access token has write permissions.';
                } else {
                    errorMessage = `Error deleting variables: ${error.message}`;
                }
            }
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: errorMessage
                }]
            };
        }
    }

    private buildDependencyGraph(variables: any[]): Map<string, string[]> {
        const graph = new Map<string, string[]>();
        
        variables.forEach(variable => {
            if (variable.resolvedType === 'VARIABLE_REFERENCE') {
                const sourceId = variable.id;
                const targetId = variable.valuesByMode?.default?.referencedVariableId;
                
                if (!graph.has(sourceId)) {
                    graph.set(sourceId, []);
                }
                if (targetId) {
                    graph.get(sourceId)!.push(targetId);
                }
            }
        });
        
        return graph;
    }

    private detectCycles(graph: Map<string, string[]>, start: string, visited = new Set<string>(), path = new Set<string>()): boolean {
        if (path.has(start)) {
            return true; // Cycle detected
        }
        if (visited.has(start)) {
            return false; // Already checked this path
        }
        
        visited.add(start);
        path.add(start);
        
        const dependencies = graph.get(start) || [];
        for (const dep of dependencies) {
            if (this.detectCycles(graph, dep, visited, path)) {
                return true;
            }
        }
        
        path.delete(start);
        return false;
    }

    async createReference(args: unknown) {
        const { CreateReferenceSchema } = require('./figma-tools');
        const { fileKey, sourceId, targetId, expression } = CreateReferenceSchema.parse(args);

        try {
            // Validate that both variables exist
            const variables = await this.makeFigmaRequest(`/files/${fileKey}/variables`);
            const source = variables.find((v: any) => v.id === sourceId);
            const target = variables.find((v: any) => v.id === targetId);

            if (!source) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: `Source variable ${sourceId} not found`
                    }]
                };
            }

            if (!target) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: `Target variable ${targetId} not found`
                    }]
                };
            }

            // Create the reference
            await this.makeFigmaRequest(`/files/${fileKey}/variables/${sourceId}/reference`, {
                method: 'PUT',
                body: JSON.stringify({
                    referencedVariableId: targetId,
                    expression: expression || undefined
                })
            });

            return {
                content: [{
                    type: "text",
                    text: `Created reference from ${source.name} to ${target.name}${expression ? ` with expression: ${expression}` : ''}`
                }]
            };
        } catch (error) {
            let errorMessage = 'Failed to create reference';
            if (error instanceof Error) {
                if (error.message.includes('404')) {
                    errorMessage = `File not found: ${fileKey}`;
                } else if (error.message.includes('403')) {
                    errorMessage = 'Access denied. Please verify your Figma access token has write permissions.';
                } else {
                    errorMessage = `Error creating reference: ${error.message}`;
                }
            }
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: errorMessage
                }]
            };
        }
    }

    async validateReferences(args: unknown) {
        const { ValidateReferencesSchema } = require('./figma-tools');
        const { fileKey, variableIds } = ValidateReferencesSchema.parse(args);

        try {
            // Get all variables
            const variables = await this.makeFigmaRequest(`/files/${fileKey}/variables`);
            
            // Build dependency graph
            const graph = this.buildDependencyGraph(variables);
            
            // Check for cycles and validate references
            const results: Array<{ variableId: string; error: string }> = [];
            const varsToCheck = variableIds || [...graph.keys()];

            for (const varId of varsToCheck) {
                // Check if variable exists
                const variable = variables.find((v: any) => v.id === varId);
                if (!variable) {
                    results.push({ variableId: varId, error: 'Variable not found' });
                    continue;
                }

                // Check for circular references
                if (this.detectCycles(graph, varId)) {
                    results.push({ variableId: varId, error: 'Circular reference detected' });
                }

                // Validate referenced variables exist
                const dependencies = graph.get(varId) || [];
                for (const depId of dependencies) {
                    const dep = variables.find((v: any) => v.id === depId);
                    if (!dep) {
                        results.push({ variableId: varId, error: `Referenced variable ${depId} not found` });
                    }
                }
            }

            return {
                content: [{
                    type: "text",
                    text: results.length > 0
                        ? `Validation issues found:\n${results.map(r => `- ${r.variableId}: ${r.error}`).join('\n')}`
                        : 'All references are valid'
                }]
            };
        } catch (error) {
            let errorMessage = 'Failed to validate references';
            if (error instanceof Error) {
                if (error.message.includes('404')) {
                    errorMessage = `File not found: ${fileKey}`;
                } else if (error.message.includes('403')) {
                    errorMessage = 'Access denied. Please verify your Figma access token has read permissions.';
                } else {
                    errorMessage = `Error validating references: ${error.message}`;
                }
            }
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: errorMessage
                }]
            };
        }
    }

    async createTheme(args: unknown) {
        const { CreateThemeSchema } = require('./figma-tools');
        const { fileKey, name, modes } = CreateThemeSchema.parse(args);

        try {
            // Create a collection for the theme
            const collection = await this.makeFigmaRequest(`/files/${fileKey}/variables/create-collection`, {
                method: 'POST',
                body: JSON.stringify({
                    name: name,
                    variableTypes: ["COLOR", "FLOAT", "STRING"] // Support all variable types
                })
            });

            // Process each mode
            const results = await Promise.all(
                modes.map(async (mode: ThemeMode) => {
                    try {
                        // Create the mode in the collection
                        await this.makeFigmaRequest(`/files/${fileKey}/variables/modes`, {
                            method: 'POST',
                            body: JSON.stringify({
                                collectionId: collection.id,
                                name: mode.name
                            })
                        });

                        // Apply variable values for this mode
                        const modeUpdates = await Promise.all(
                            mode.variables.map(async (varConfig) => {
                                try {
                                    await this.makeFigmaRequest(`/files/${fileKey}/variables/${varConfig.variableId}/modes`, {
                                        method: 'PATCH',
                                        body: JSON.stringify({
                                            mode: mode.name,
                                            value: varConfig.value
                                        })
                                    });
                                    return `Set ${varConfig.variableId} for mode ${mode.name}`;
                                } catch (error) {
                                    return `Failed to set ${varConfig.variableId} for mode ${mode.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                                }
                            })
                        );

                        return `Created mode ${mode.name}:\n${modeUpdates.map(msg => `  - ${msg}`).join('\n')}`;
                    } catch (error) {
                        return `Failed to create mode ${mode.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    }
                })
            );

            return {
                content: [{
                    type: "text",
                    text: `Created theme "${name}" with modes:\n${results.map(r => r).join('\n')}`
                }]
            };
        } catch (error) {
            let errorMessage = 'Failed to create theme';
            if (error instanceof Error) {
                if (error.message.includes('404')) {
                    errorMessage = `File not found: ${fileKey}`;
                } else if (error.message.includes('403')) {
                    errorMessage = 'Access denied. Please verify your Figma access token has write permissions.';
                } else {
                    errorMessage = `Error creating theme: ${error.message}`;
                }
            }
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: errorMessage
                }]
            };
        }
    }
}