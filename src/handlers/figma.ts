import fetch from 'node-fetch';
import debug from 'debug';
import { ResourceContents } from '@modelcontextprotocol/sdk/types';

import { ResourceHandler, FigmaResource } from '../types.js';
import { validateUri } from '../middleware/auth.js';
import { ResourceNotFoundError, ResourceAccessDeniedError } from '../errors.js';

const log = debug('figma-mcp:figma-handler');

export class FigmaResourceHandler implements ResourceHandler {
  private baseUrl = 'https://api.figma.com/v1';

  constructor(private token: string) {}

  private async figmaRequest(path: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        'X-Figma-Token': this.token
      }
    });

    if (response.status === 404) {
      throw new ResourceNotFoundError('Figma resource not found');
    }

    if (response.status === 403) {
      throw new ResourceAccessDeniedError('Access to Figma resource denied');
    }

    if (!response.ok) {
      throw new Error(`Figma API error: ${response.statusText}`);
    }

    return response.json();
  }

  async list(): Promise<FigmaResource[]> {
    log('Listing Figma resources');
    const files = await this.figmaRequest('/files');
    
    const resources: FigmaResource[] = [];

    // Add file resources
    for (const file of files.files) {
      resources.push({
        uri: `figma:///file/${file.key}`,
        type: 'file',
        name: file.name,
        metadata: {
          lastModified: file.lastModified,
          thumbnailUrl: file.thumbnailUrl,
          version: file.version
        }
      });
    }

    return resources;
  }

  async read(uri: string): Promise<ResourceContents[]> {
    const { type, fileKey, resourceId } = validateUri(uri);
    log('Reading Figma resource:', { type, fileKey, resourceId });

    switch (type) {
      case 'file': {
        const file = await this.figmaRequest(`/files/${fileKey}`);
        return [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(file, null, 2)
        }];
      }

      case 'component': {
        if (!resourceId) throw new Error('Component ID required');
        const component = await this.figmaRequest(`/files/${fileKey}/components/${resourceId}`);
        return [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(component, null, 2)
        }];
      }

      case 'variable': {
        if (!resourceId) throw new Error('Variable ID required');
        const variable = await this.figmaRequest(`/files/${fileKey}/variables/${resourceId}`);
        return [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(variable, null, 2)
        }];
      }

      default:
        throw new Error(`Unsupported resource type: ${type}`);
    }
  }

  async search(query: string): Promise<FigmaResource[]> {
    log('Searching Figma resources:', query);
    const searchResults = await this.figmaRequest(`/search?query=${encodeURIComponent(query)}`);
    
    return searchResults.files.map((file: any) => ({
      uri: `figma:///file/${file.key}`,
      type: 'file',
      name: file.name,
      metadata: {
        lastModified: file.lastModified,
        thumbnailUrl: file.thumbnailUrl
      }
    }));
  }

  async watch(uri: string): Promise<void> {
    const { type, fileKey } = validateUri(uri);
    log('Setting up watch for Figma resource:', { type, fileKey });

    // For now, just verify the resource exists
    if (type === 'file') {
      await this.figmaRequest(`/files/${fileKey}`);
    }
    // Real-time updates would require WebSocket implementation
  }
}
