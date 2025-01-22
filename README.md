# Figma MCP Server

A TypeScript server implementing the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) for the Figma API, enabling standardized context provision for LLMs.

## Overview

This server provides MCP-compliant access to Figma resources, allowing LLM applications to seamlessly integrate with Figma files, components, and variables. It implements the full MCP specification while providing specialized handlers for Figma's unique resource types.

### Key Features

- **MCP Resource Handlers**
  - Read-only access to Figma files
  - View existing variables and components
  - Custom URI scheme (figma:///)
  
- **Robust Implementation**
  - Type-safe implementation using TypeScript
  - Request validation using Zod schemas
  - Comprehensive error handling
  - Token validation and API integration
  - Caching and rate limiting

### Current Implementation Limitations

1. Response Data Constraints
- Node data limited to summary counts
- Component data shows count without details
- Style information limited to total numbers
- Detailed information requires multiple API calls

2. Performance Considerations
- Large files may experience slower response times
- Detailed information requires sequential API requests
- Rate limiting affects data retrieval speed
- Cache invalidation may impact response times

3. Platform Compatibility
- Some features require newer Figma file versions
- Variable support depends on file schema version
- Component structure varies by file version
- Team library components may have limited visibility

4. Known Edge Cases
- Files with many nodes may timeout
- Component-heavy files return limited data
- Complex variable relationships may be incomplete
- Partial data access based on permissions

5. Performance Bottlenecks
- Initial responses limited to summary counts
- Detailed data requires multiple round trips
- Memory usage increases with response size
- Rate limits affect data completeness

## Project Structure

```
figma-mcp-server/
├── src/
│   ├── index.ts         # Main server implementation
│   ├── types.ts         # TypeScript types & interfaces
│   ├── schemas.ts       # Zod validation schemas
│   ├── errors.ts        # Error handling
│   ├── handlers/        # Resource handlers
│   │   ├── file.ts     # File resource handler
│   │   ├── component.ts # Component resource handler
│   │   └── variable.ts  # Variable resource handler
│   └── middleware/      # Server middleware
│       ├── auth.ts      # Authentication middleware
│       └── rate-limit.ts# Rate limiting middleware
├── tests/
│   └── api.test.ts      # API tests
└── package.json
```

## Installation

```bash
npm install @modelcontextprotocol/sdk
npm install
```

## Configuration

1. Set up your Figma access token:
   ```bash
   export FIGMA_ACCESS_TOKEN=your_access_token
   ```

2. Configure the server (optional):
   ```bash
   export MCP_SERVER_PORT=3000
   export RATE_LIMIT_REQUESTS=500  # Requests per 15 minutes
   export DEBUG=figma-mcp:*        # Enable debug logging
   ```

## Usage

### Starting the Server

```bash
npm run build
npm run start
```

### Using as an MCP Server

The server implements the Model Context Protocol, making it compatible with any MCP client. It supports both stdio and SSE transports:

#### stdio Transport
```bash
figma-mcp-server < input.jsonl > output.jsonl
```

#### SSE Transport
```bash
figma-mcp-server --transport sse --port 3000
```

### Client Integration

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Initialize the client
const transport = new StdioClientTransport({
  command: "path/to/figma-mcp-server",
});

const client = new Client({
  name: "figma-client",
  version: "1.0.0",
}, {
  capabilities: {
    resources: {} // Enable resources capability
  }
});

await client.connect(transport);

// Example operations
const resources = await client.request(
  { method: "resources/list" },
  ListResourcesResultSchema
);
```

## Resource URIs

The server implements a custom `figma:///` URI scheme for accessing Figma resources:

- Files: `figma:///file/{file_key}`
- Components: `figma:///component/{file_key}/{component_id}`
- Variables: `figma:///variable/{file_key}/{variable_id}`
- Styles: `figma:///style/{file_key}/{style_id}`
- Teams: `figma:///team/{team_id}`
- Projects: `figma:///project/{project_id}`

## Quick Start for Designers

1. Get your Figma access token:
   - Go to Figma.com > Account Settings > Access Tokens
   - Click "Create new access token"
   - Copy the token

2. Configure Claude to use the server:
   - Open Claude Desktop app settings
   - Navigate to "MCP Settings"
   - Add a new server with the following configuration:
   ```json
   {
     "mcpServers": {
       "figma": {
         "command": "node",
         "args": ["/path/to/figma-mcp-server/build/index.js"],
         "env": {
           "FIGMA_ACCESS_TOKEN": "your_access_token_here"
         }
       }
     }
   }
   ```

3. Start using with Claude:
    ```
    You can now ask Claude to:
    - "Show me the variables in my design system"
    - "List all color variables in dark mode"
    - "Find components using specific variables"
    - "Analyze my variable naming conventions"
    ```

## Working with Figma Variables

### API Response Limitations

1. Summary Data Only
- Initial responses contain count information
- Detailed node information requires additional requests
- Component properties limited in first response
- Style details need separate API calls

2. Request Optimization
- Consider implementing pagination for large datasets
- Use selective data retrieval when possible
- Cache frequently accessed information
- Plan for rate limit handling

3. Data Accessibility
- Some properties may be hidden based on permissions
- Team library access affects available data
- File version impacts available features
- Variable support depends on file schema

### Current API Limitations
The Figma API currently provides read-only access to variables and components. This means you can:
- View existing variables and their values
- List variables used in components
- Analyze variable relationships
- Review theme configurations

But you cannot:
- Create new variables
- Modify existing variables
- Create or modify themes
- Set up variable references

### Viewing Variables
Ask Claude to help analyze your design system:
```
"Show me all color variables in my file"
"List variables used in this component"
"Find all typography variables"
"Show me theme mode configurations"
```

### Variable Analysis
Get insights about your variables:
```
"Analyze my variable naming patterns"
"Show me which components use this variable"
"Find unused variables"
"Check variable organization"
```

### Best Practices

1. Variable Organization:
   - Review naming conventions
   - Analyze variable grouping
   - Check documentation completeness

2. Theme Structure:
   - Review mode configurations
   - Analyze color combinations
   - Check variable relationships

3. Usage Analysis:
   - Monitor variable usage
   - Check component dependencies
   - Review variable scoping

## Available Tools

### Getting Variables
```typescript
// Get file variables
{
  "method": "get_variables",
  "params": {
    "fileKey": "your_file_key"
  }
}

// Response includes:
{
  "variables": [
    {
      "id": "variable_id",
      "name": "Primary Color",
      "type": "COLOR",
      "value": "#0066FF",
      "scope": "ALL_FRAMES",
      "description": "Main brand color"
    }
  ]
}
```

### Variable Usage
```typescript
// Get variable usage in components
{
  "method": "get_variable_usage",
  "params": {
    "fileKey": "your_file_key",
    "variableId": "variable_id"
  }
}

// Response includes:
{
  "components": [
    {
      "id": "component_id",
      "name": "Button",
      "usageType": "fill"
    }
  ]
}
```

### Theme Information
```typescript
// Get theme mode configuration
{
  "method": "get_theme_modes",
  "params": {
    "fileKey": "your_file_key"
  }
}

// Response includes:
{
  "themes": [
    {
      "name": "Brand Theme",
      "modes": [
        {
          "name": "light",
          "variables": [
            {
              "id": "background",
              "value": "#FFFFFF"
            }
          ]
        }
      ]
    }
  ]
}
```

## Developer Setup

1. Clone and install:
```bash
git clone <repository-url>
cd figma-mcp-server
npm install
```

2. Build the server:
```bash
npm run build
```

3. Set up environment:
```bash
# Required
export FIGMA_ACCESS_TOKEN=your_access_token

# Optional
export MCP_SERVER_PORT=3000
export RATE_LIMIT_REQUESTS=500
export DEBUG=figma-mcp:*
```

4. Configure in Claude:
   - Add the server configuration to Claude's MCP settings
   - Test connection using Claude's system prompt

5. Development:
```bash
# Watch mode
npm run dev

# Run tests
npm test

# Build
npm run build
```

### Implemented Features
- [x] Basic MCP server implementation
- [x] File resource handling
- [x] Component resource handling
- [x] Read-only variable access
  - [x] View variables and values
  - [x] List variable usage in components
  - [x] View theme configurations
  - [x] Variable relationship analysis
- [x] Authentication middleware
- [x] Rate limiting with caching
- [x] Comprehensive error handling
- [x] Test coverage

### Upcoming Features
- [ ] WebSocket transport support
- [ ] Resource change notifications
- [ ] Plugin system for custom handlers
- [ ] Enhanced analysis tools
- [ ] Asset export capabilities
- [ ] Performance optimizations

## Error Handling

### MCP Protocol Errors
- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32602`: Invalid parameters
- `-32603`: Internal error

### Resource Errors
- `100`: Resource not found
- `101`: Resource access denied
- `102`: Resource temporarily unavailable

### Figma API Errors
The server handles Figma API errors and maps them to appropriate MCP error codes:

- `403 Forbidden`: Maps to error code 101 (Resource access denied)
  ```json
  {
    "code": 101,
    "message": "Access to Figma resource denied",
    "data": {
      "figmaError": "Invalid access token"
    }
  }
  ```

- `404 Not Found`: Maps to error code 100 (Resource not found)
  ```json
  {
    "code": 100,
    "message": "Figma resource not found",
    "data": {
      "uri": "figma:///file/invalid_key"
    }
  }
  ```

- `429 Too Many Requests`: Maps to error code 102 (Resource temporarily unavailable)
  ```json
  {
    "code": 102,
    "message": "Figma API rate limit exceeded",
    "data": {
      "retryAfter": 300
    }
  }
  ```

## Rate Limiting

The server implements smart rate limiting to prevent hitting Figma API limits:

- Default limit: 500 requests per 15 minutes
- Request caching for repeated queries
- Configurable rate limit via environment variables
- Rate limit status endpoint: `GET /rate-limit-status`

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 486
X-RateLimit-Reset: 1623456789
```

## Development

Enable debug logging by setting the DEBUG environment variable:

```bash
DEBUG=figma-mcp:* npm start
```

Debug namespaces:
- `figma-mcp:server`: Server operations
- `figma-mcp:handler`: Resource handlers
- `figma-mcp:api`: Figma API calls
- `figma-mcp:rate-limit`: Rate limiting

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [MCP Specification](https://spec.modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Figma API Documentation](https://www.figma.com/developers/api)