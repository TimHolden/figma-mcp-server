import { Tool } from '@modelcontextprotocol/sdk/types';
import { z } from 'zod';

// Tool definitions
export const FIGMA_TOOLS: Tool[] = [
    {
        name: "delete_variables",
        description: "Delete variables from a Figma file",
        inputSchema: {
            type: "object",
            properties: {
                fileKey: {
                    type: "string",
                    description: "Figma file key"
                },
                variableIds: {
                    type: "array",
                    description: "Array of variable IDs to delete",
                    items: {
                        type: "string"
                    }
                },
                softDelete: {
                    type: "boolean",
                    description: "If true, variables can be restored later (default: false)",
                    default: false
                }
            },
            required: ["fileKey", "variableIds"]
        }
    },
    {
        name: "update_variables",
        description: "Update existing variables in a Figma file",
        inputSchema: {
            type: "object",
            properties: {
                fileKey: {
                    type: "string",
                    description: "Figma file key"
                },
                updates: {
                    type: "array",
                    description: "Array of variable updates",
                    items: {
                        type: "object",
                        properties: {
                            variableId: {
                                type: "string",
                                description: "ID of the variable to update"
                            },
                            value: {
                                type: "string",
                                description: "New value for the variable"
                            },
                            description: {
                                type: "string",
                                description: "Updated description (optional)"
                            }
                        },
                        required: ["variableId", "value"]
                    }
                }
            },
            required: ["fileKey", "updates"]
        }
    },
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

export const UpdateVariablesSchema = z.object({
    fileKey: z.string(),
    updates: z.array(
        z.object({
            variableId: z.string(),
            value: z.string(),
            description: z.string().optional()
        })
    )
});

export const DeleteVariablesSchema = z.object({
    fileKey: z.string(),
    variableIds: z.array(z.string()),
    softDelete: z.boolean().optional().default(false)
});