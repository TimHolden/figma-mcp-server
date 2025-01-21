import { Tool } from '@modelcontextprotocol/sdk/types';
import { z } from 'zod';

// Tool definitions
export const FIGMA_TOOLS: Tool[] = [
    {
        name: "create_reference",
        description: "Create a reference between variables",
        inputSchema: {
            type: "object",
            properties: {
                fileKey: {
                    type: "string",
                    description: "Figma file key"
                },
                sourceId: {
                    type: "string",
                    description: "ID of the source variable"
                },
                targetId: {
                    type: "string",
                    description: "ID of the target variable to reference"
                },
                expression: {
                    type: "string",
                    description: "Optional expression to transform the referenced value (e.g., '* 0.5' to use half the value)",
                    default: ""
                }
            },
            required: ["fileKey", "sourceId", "targetId"]
        }
    },
    {
        name: "validate_references",
        description: "Check for circular references and validate dependencies",
        inputSchema: {
            type: "object",
            properties: {
                fileKey: {
                    type: "string",
                    description: "Figma file key"
                },
                variableIds: {
                    type: "array",
                    description: "Optional array of variable IDs to validate. If not provided, validates all variables.",
                    items: {
                        type: "string"
                    }
                }
            },
            required: ["fileKey"]
        }
    },
    {
        name: "create_theme",
        description: "Create a theme with variable mode configurations",
        inputSchema: {
            type: "object",
            properties: {
                fileKey: {
                    type: "string",
                    description: "Figma file key"
                },
                name: {
                    type: "string",
                    description: "Theme name"
                },
                modes: {
                    type: "array",
                    description: "Array of mode configurations",
                    items: {
                        type: "object",
                        properties: {
                            name: {
                                type: "string",
                                description: "Mode name (e.g., 'light', 'dark')"
                            },
                            variables: {
                                type: "array",
                                description: "Variable values for this mode",
                                items: {
                                    type: "object",
                                    properties: {
                                        variableId: {
                                            type: "string",
                                            description: "ID of the variable to configure"
                                        },
                                        value: {
                                            type: "string",
                                            description: "Value for this mode"
                                        }
                                    },
                                    required: ["variableId", "value"]
                                }
                            }
                        },
                        required: ["name", "variables"]
                    }
                }
            },
            required: ["fileKey", "name", "modes"]
        }
    },
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

export const CreateReferenceSchema = z.object({
    fileKey: z.string(),
    sourceId: z.string(),
    targetId: z.string(),
    expression: z.string().optional().default("")
});

export const ValidateReferencesSchema = z.object({
    fileKey: z.string(),
    variableIds: z.array(z.string()).optional()
});

export const CreateThemeSchema = z.object({
    fileKey: z.string(),
    name: z.string(),
    modes: z.array(
        z.object({
            name: z.string(),
            variables: z.array(
                z.object({
                    variableId: z.string(),
                    value: z.string()
                })
            )
        })
    )
});