import { McpError } from '@modelcontextprotocol/sdk/types';

export class ResourceNotFoundError extends McpError {
  constructor(message: string) {
    super(100, message);
  }
}

export class ResourceAccessDeniedError extends McpError {
  constructor(message: string) {
    super(101, message);
  }
}

export class ResourceTemporarilyUnavailableError extends McpError {
  constructor(message: string) {
    super(102, message);
  }
}

export class InvalidFigmaTokenError extends McpError {
  constructor() {
    super(-32603, 'Invalid or missing Figma access token');
  }
}

export class InvalidUriError extends McpError {
  constructor(uri: string) {
    super(-32602, `Invalid Figma URI format: ${uri}`);
  }
}