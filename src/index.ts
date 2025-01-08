import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from 'zod';
import axios from 'axios';
import dotenv from 'dotenv';

// Define Zod schemas for request parameters
function createSchema<T extends z.ZodRawShape>(method: string, schema: z.ZodObject<T>) {
  return z.object({
    method: z.literal(method),
    params: schema
  });
};

const fileIdSchema = createSchema("figma/files/get", z.object({
  fileId: z.string()
}));

const exportSchema = createSchema("figma/files/export", z.object({
  fileId: z.string(),
  format: z.string().optional(),
  scale: z.number().optional()
}));

const componentSchema = createSchema("figma/components/get", z.object({
  fileId: z.string(),
  nodeId: z.string()
}));

const teamSchema = createSchema("figma/team/components", z.object({
  teamId: z.string()
}));

const commentSchema = createSchema("figma/comments/post", z.object({
  fileId: z.string(),
  message: z.string(),
  client_meta: z.any().optional()
}));

const styleSchema = createSchema("figma/styles/get", z.object({
  styleId: z.string()
}));

const projectSchema = createSchema("figma/projects/files", z.object({
  projectId: z.string()
}));

const imageSchema = createSchema("figma/images/get", z.object({
  fileId: z.string(),
  ids: z.union([z.string(), z.array(z.string())])
}));

const variableCollectionSchema = createSchema("figma/variables/collections/create", z.object({
  fileId: z.string(),
  name: z.string(),
  variableIds: z.array(z.string()).optional()
}));

const variableSchema = createSchema("figma/variables/create", z.object({
  fileId: z.string(),
  collectionId: z.string(),
  name: z.string(),
  resolvedType: z.string(),
  value: z.any()
}));

const variableUpdateSchema = createSchema("figma/variables/update", z.object({
  fileId: z.string(),
  variableId: z.string()
}).passthrough());

const modeSchema = createSchema("figma/variables/modes", z.object({
  fileId: z.string(),
  collectionId: z.string()
}));

const collectionUpdateSchema = createSchema("figma/variables/collections/update", z.object({
  fileId: z.string(),
  collectionId: z.string()
}).passthrough());

dotenv.config();

// Variable collection interface
interface VariableCollection {
    id: string;
    name: string;
    variableIds: string[];
    defaultModeId: string;
    modeIds: string[];
    remote: boolean;
}

// Variable interface
interface Variable {
    id: string;
    name: string;
    key: string;
    resolvedType: string;
    description: string;
    hiddenFromPublishing: boolean;
    scopes: string[];
    codeSyntax: {
        web: string;
        android: string;
        ios: string;
    };
    remote: boolean;
    value: any;
}

class FigmaAPIServer {
    private server: Server;
    private figmaToken: string;
    private baseURL = 'https://api.figma.com/v1';

    constructor(figmaToken: string) {
        this.figmaToken = figmaToken;
        this.server = new Server({
            name: "figma-api-server",
            version: "1.0.0",
        }, {
            capabilities: {
                resources: {},
                commands: {},
                events: {}
            }
        });

        this.setupAPIHandlers();
        this.setupVariableHandlers();
    }

    private async figmaRequest(method: string, endpoint: string, data?: any) {
        try {
            const response = await axios({
                method,
                url: `${this.baseURL}${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${this.figmaToken}`,
                    'Content-Type': 'application/json'
                },
                data
            });
            return response.data;
        } catch (error) {
            console.error(`Figma API error: ${endpoint}`, error);
            throw error;
        }
    }

    private setupAPIHandlers() {
        // Files API
        this.server.setRequestHandler(fileIdSchema, async (request) => {
            const { fileId } = request.params;
            return await this.figmaRequest('GET', `/files/${fileId}`);
        });

        // Export files
        this.server.setRequestHandler(exportSchema, async (request) => {
            const { fileId, format, scale } = request.params;
            return await this.figmaRequest('GET', `/images/${fileId}`, {
                format: format || 'png',
                scale: scale || 1
            });
        });

        // Components API
        this.server.setRequestHandler(componentSchema, async (request) => {
            const { fileId, nodeId } = request.params;
            return await this.figmaRequest('GET', `/components/${fileId}/${nodeId}`);
        });

        // Team components
        this.server.setRequestHandler(teamSchema, async (request) => {
            const { teamId } = request.params;
            return await this.figmaRequest('GET', `/teams/${teamId}/components`);
        });

        // Comments API
        this.server.setRequestHandler(fileIdSchema, async (request) => {
            const { fileId } = request.params;
            return await this.figmaRequest('GET', `/files/${fileId}/comments`);
        });

        this.server.setRequestHandler(commentSchema, async (request) => {
            const { fileId, message, client_meta } = request.params;
            return await this.figmaRequest('POST', `/files/${fileId}/comments`, {
                message,
                client_meta
            });
        });

        // File versions
        this.server.setRequestHandler(fileIdSchema, async (request) => {
            const { fileId } = request.params;
            return await this.figmaRequest('GET', `/files/${fileId}/versions`);
        });

        // Styles
        this.server.setRequestHandler(styleSchema, async (request) => {
            const { styleId } = request.params;
            return await this.figmaRequest('GET', `/styles/${styleId}`);
        });

        // Projects
        this.server.setRequestHandler(projectSchema, async (request) => {
            const { projectId } = request.params;
            return await this.figmaRequest('GET', `/projects/${projectId}/files`);
        });

        // Image fills
        this.server.setRequestHandler(imageSchema, async (request) => {
            const { fileId, ids } = request.params;
            return await this.figmaRequest('GET', `/images/${fileId}`, {
                ids: Array.isArray(ids) ? ids.join(',') : ids
            });
        });
    }

    private setupVariableHandlers() {
        // Get all variable collections in a file
        this.server.setRequestHandler(fileIdSchema, async (request) => {
            const { fileId } = request.params;
            return await this.figmaRequest('GET', `/files/${fileId}/variable_collections`);
        });

        // Get variables in a file
        this.server.setRequestHandler(fileIdSchema, async (request) => {
            const { fileId } = request.params;
            return await this.figmaRequest('GET', `/files/${fileId}/variables`);
        });

        // Create a variable collection
        this.server.setRequestHandler(variableCollectionSchema, async (request) => {
            const { fileId, name, variableIds = [] } = request.params;
            return await this.figmaRequest('POST', `/files/${fileId}/variable_collections`, {
                name,
                variableIds
            });
        });

        // Create a variable
        this.server.setRequestHandler(variableSchema, async (request) => {
            const { fileId, collectionId, name, resolvedType, value } = request.params;
            return await this.figmaRequest('POST', `/files/${fileId}/variables`, {
                name,
                resolvedType,
                collectionId,
                value
            });
        });

        // Update a variable
        this.server.setRequestHandler(variableUpdateSchema, async (request) => {
            const { fileId, variableId, ...updates } = request.params;
            return await this.figmaRequest('PUT', `/files/${fileId}/variables/${variableId}`, updates);
        });

        // Delete a variable
        this.server.setRequestHandler(variableUpdateSchema, async (request) => {
            const { fileId, variableId } = request.params;
            return await this.figmaRequest('DELETE', `/files/${fileId}/variables/${variableId}`);
        });

        // Get variable modes
        this.server.setRequestHandler(modeSchema, async (request) => {
            const { fileId, collectionId } = request.params;
            return await this.figmaRequest('GET', `/files/${fileId}/variable_collections/${collectionId}/modes`);
        });

        // Update variable collection
        this.server.setRequestHandler(collectionUpdateSchema, async (request) => {
            const { fileId, collectionId, ...updates } = request.params;
            return await this.figmaRequest('PUT', `/files/${fileId}/variable_collections/${collectionId}`, updates);
        });

        // Delete variable collection
        this.server.setRequestHandler(modeSchema, async (request) => {
            const { fileId, collectionId } = request.params;
            return await this.figmaRequest('DELETE', `/files/${fileId}/variable_collections/${collectionId}`);
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
    const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
    if (!figmaToken) {
        throw new Error('FIGMA_ACCESS_TOKEN environment variable is required');
    }

    const server = new FigmaAPIServer(figmaToken);
    await server.start();
}

main().catch(console.error);
