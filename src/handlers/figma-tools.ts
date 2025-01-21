import { Tool } from '@modelcontextprotocol/sdk/types';
import { z } from 'zod';

// Tool definitions
export const FIGMA_TOOLS: Tool[] = [
    {
        name: "search_files",
        description: "Search for Figma files by name or keywords",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search query to find files"
                }
            },
            required: ["query"]
        }
    },
    {
        name: "get_file_details",
        description: "Get detailed information about a specific Figma file",
        inputSchema: {
            type: "object", 
            properties: {
                fileKey: {
                    type: "string",
                    description: "Figma file key (found in file URL)"
                }
            },
            required: ["fileKey"]
        }
    },
    {
        name: "list_components",
        description: "List all components in a Figma file",
        inputSchema: {
            type: "object",
            properties: {
                fileKey: {
                    type: "string",
                    description: "Figma file key"
                }
            },
            required: ["fileKey"]
        }
    }
];

// Input validation schemas
export const SearchFilesSchema = z.object({
    query: z.string()
});

export const GetFileDetailsSchema = z.object({
    fileKey: z.string()
});

export const ListComponentsSchema = z.object({
    fileKey: z.string()
});