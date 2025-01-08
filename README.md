# Figma MCP Server

A TypeScript server implementing the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) for the Figma API, enabling standardized context provision for LLMs.

## Overview

This server provides MCP-compliant access to Figma resources, allowing LLM applications to seamlessly integrate with Figma files, components, and variables. It implements the full MCP specification while providing specialized handlers for Figma's unique resource types.

### Key Features

- **MCP Resource Handlers**
  - Figma files access and manipulation
  - Variables and components management
  - Custom URI scheme (figma:///)
  
- **Robust Implementation**
  - Type-safe implementation using TypeScript
  - Request validation using Zod schemas
  - Comprehensive error handling
  - Token validation and API integration
  - Batch operations support

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
- Automatic retry handling for rate-limited requests
- Configurable rate limit via environment variables
- Rate limit status endpoint: `GET /rate-limit-status`

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 486
X-RateLimit-Reset: 1623456789
```

## Development

### Setting Up Development Environment

```bash
npm install
npm run build
```

### Running Tests

```bash
npm test
```

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Current Status and Roadmap

### Implemented Features
- [x] Basic MCP server implementation
- [x] File resource handling
- [x] Component resource handling
- [x] Variable resource handling
- [x] Authentication middleware
- [x] Rate limiting
- [x] Error mapping
- [x] Basic test coverage

### Upcoming Features
- [ ] WebSocket transport support (In Progress)
- [ ] Resource change notifications
- [ ] Caching layer implementation
- [ ] Plugin system for custom handlers
- [ ] Enhanced test coverage
- [ ] Performance optimizations
- [ ] Batch operation improvements
- [ ] Documentation expansion

## Debugging

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