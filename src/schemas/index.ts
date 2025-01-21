import { z } from 'zod';

export const FileResponseSchema = z.object({
    _meta: z.object({}).optional(),
    type: z.string(),
    content: z.any(),
    mime: z.string()
});

export const ResourceListResponseSchema = z.object({
    _meta: z.object({}).optional(),
    resources: z.array(z.object({
        uri: z.string(),
        type: z.string(),
        name: z.string(),
        description: z.string().optional(),
        metadata: z.record(z.any()).optional()
    }))
});

export const ResourceReadResponseSchema = z.object({
    _meta: z.object({}).optional(),
    contents: z.array(z.object({
        uri: z.string(),
        mimeType: z.string(),
        text: z.string()
    }))
});

export const ResourceWatchResponseSchema = z.object({
    _meta: z.object({}).optional(),
    uri: z.string(),
    status: z.string()
});

export const HealthResponseSchema = z.object({
    status: z.enum(['healthy', 'unhealthy']),
    activeConnections: z.number(),
    timestamp: z.string(),
    version: z.string(),
    capabilities: z.object({
        commands: z.record(z.boolean())
    })
});