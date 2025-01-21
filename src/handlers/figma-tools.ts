import { Tool } from '@modelcontextprotocol/sdk/types';
import { z } from 'zod';

// Tool definitions
export const FIGMA_TOOLS: Tool[] = [
    {
        name: "create_variables",
        description: "Create variables in a Figma file",
        inputSchema: {
            type: "object",
            properties: {
                fileKey: {
                    type: "string",
                    description: "Figma file key"
                },
                variables: {
                    type: "array",
                    description: "Array of variables to create",
                    items: {
                        type: "object",
                        properties: {
                            name: {
                                type: "string",
                                description: "Name of the variable"
                            },
                            type: {
                                type: "string",
                                enum: ["COLOR", "FLOAT", "STRING"],
                                description: "Type of variable"
                            },
                            value: {
                                type: "string",
                                description: "Variable value (hex color for COLOR, number for FLOAT, text for STRING)"
                            },
                            scope: {
                                type: "string",
                                enum: ["LOCAL", "ALL_FRAMES"],
                                description: "Scope of the variable"
                            },
                            description: {
                                type: "string",
                                description: "Optional description of the variable"
                            }
                        },
                        required: ["name", "type", "value", "scope"]
                    }
                }
            },
            required: ["fileKey", "variables"]
        }
    },
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

export const CreateVariablesSchema = z.object({
    fileKey: z.string(),
    variables: z.array(
        z.object({
            name: z.string(),
            type: z.enum(["COLOR", "FLOAT", "STRING"]),
            value: z.string(),
            scope: z.enum(["LOCAL", "ALL_FRAMES"]),
            description: z.string().optional()
        })
    )
});