import { z } from 'zod';

// URI validation schemas
const UriSchema = z.string().url();

export const FigmaUriSchema = z.string().regex(/^figma:\/\/\/(file|component|variable|project)\/([^\/]+)(\/([^\/]+))?$/);

interface ParsedUri {
    type: string;
    fileKey?: string;
    resourceId?: string;
}

export function validateUri(uri: string): ParsedUri {
    const matches = FigmaUriSchema.safeParse(uri);
    
    if (!matches.success) {
        throw new Error(`Invalid Figma URI format: ${uri}`);
    }

    const parts = uri.replace('figma:///', '').split('/');
    const type = parts[0];
    
    // Different parsing based on resource type
    if (type === 'file') {
        return {
            type,
            fileKey: parts[1]
        };
    } else if (type === 'project') {
        return {
            type,
            resourceId: parts[1]
        };
    } else {
        // For components and variables
        return {
            type,
            fileKey: parts[1],
            resourceId: parts[2]
        };
    }
}

// Resource response schemas
export const ResourceListResponseSchema = z.object({
    resources: z.array(z.object({
        uri: z.string(),
        name: z.string(),
        type: z.string(),
        metadata: z.optional(z.record(z.unknown()))
    }))
});

export const ResourceReadResponseSchema = z.object({
    contents: z.array(z.object({
        uri: z.string(),
        mimeType: z.string(),
        text: z.optional(z.string()),
        blob: z.optional(z.string())
    }))
});

export const ResourceWatchResponseSchema = z.object({
    uri: z.string()
});

// File schemas
export const FileResponseSchema = z.object({
    document: z.any(),
    components: z.record(z.any()),
    schemaVersion: z.number(),
    styles: z.record(z.any()),
    name: z.string(),
    lastModified: z.string(),
    thumbnailUrl: z.string(),
    version: z.string(),
    role: z.string()
});

// Component schemas
export const ComponentResponseSchema = z.object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    componentSetId: z.optional(z.string()),
    documentationLinks: z.optional(z.array(z.string()))
});

// Variable schemas
export const VariableResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    key: z.string(),
    variableCollectionId: z.string(),
    resolvedType: z.string(),
    description: z.optional(z.string()),
    hiddenFromPublishing: z.optional(z.boolean()),
    scopes: z.array(z.string())
});

// Project schemas
export const ProjectResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    lastModified: z.string(),
    teamId: z.optional(z.string()),
    files: z.array(z.object({
        key: z.string(),
        name: z.string(),
        thumbnailUrl: z.optional(z.string()),
        lastModified: z.string()
    }))
});

// Search schemas
export const SearchResponseSchema = z.object({
    files: z.array(z.object({
        key: z.string(),
        name: z.string(),
        thumbnailUrl: z.optional(z.string()),
        lastModified: z.string(),
        description: z.optional(z.string())
    }))
});

// Tool input schemas - these match the JSON schema in figma-tools.ts
export const FigmaGetFileSchema = z.object({
    fileKey: z.string().regex(/^[a-zA-Z0-9]{22,128}$/, 'Invalid Figma file key format')
});

export const FigmaListFilesSchema = z.object({
    projectId: z.string()
});

export const FigmaGetComponentSchema = z.object({
    fileKey: z.string().regex(/^[a-zA-Z0-9]{22,128}$/, 'Invalid Figma file key format'),
    componentId: z.string()
});

export const FigmaGetVariablesSchema = z.object({
    fileKey: z.string().regex(/^[a-zA-Z0-9]{22,128}$/, 'Invalid Figma file key format'),
    variableId: z.optional(z.string())
});

export const FigmaError = z.object({
    status: z.number(),
    error: z.boolean(),
    message: z.string()
});

export const FigmaSearchParamsSchema = z.object({
    query: z.string().min(1),
    filterType: z.enum(['FILES', 'PROJECTS', 'TEAMS']).optional(),
    teamId: z.string().optional(),
    projectId: z.string().optional(),
    page: z.number().min(1).optional(),
    limit: z.number().min(1).max(100).optional()
});

// Config schemas
export const ServerConfigSchema = z.object({
    port: z.number().optional(),
    host: z.string().optional(),
    figmaToken: z.string(),
    debug: z.boolean().optional(),
    maxCacheSize: z.number().optional(),
    rateLimitWindow: z.number().optional(),
    maxRequestsPerWindow: z.number().optional(),
    sessionTimeout: z.number().optional()
});

// Response formatting
export function formatError(error: Error, status: number = 500): z.infer<typeof FigmaError> {
    return {
        status,
        error: true,
        message: error.message
    };
}

export function validateConfig(config: unknown): z.infer<typeof ServerConfigSchema> {
    return ServerConfigSchema.parse(config);
}
