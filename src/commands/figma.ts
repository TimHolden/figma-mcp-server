import { z } from 'zod';
import { ResourceNotFoundError } from '../errors.js';
import { FigmaHandler } from '../handlers/figma.js';

export class FigmaCommands {
    constructor(private handler: FigmaHandler) {}

    async getFigmaFile(fileId: string) {
        try {
            return await this.handler.getFigmaFile({ fileKey: fileId });
        } catch (error) {
            if (error instanceof ResourceNotFoundError) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `File not found: ${fileId}` }]
                };
            }
            throw error;
        }
    }

    async listFigmaFiles(projectId: string) {
        try {
            return await this.handler.listFigmaFiles({ projectId });
        } catch (error) {
            if (error instanceof ResourceNotFoundError) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Project not found: ${projectId}` }]
                };
            }
            throw error;
        }
    }
}