import { InvalidFigmaTokenError, InvalidUriError } from '../errors.js';

export class AuthMiddleware {
    constructor(private figmaToken: string) {}

    async validateToken() {
        if (!this.figmaToken) {
            throw new InvalidFigmaTokenError('No Figma token provided');
        }

        try {
            const response = await fetch('https://api.figma.com/v1/me', {
                headers: {
                    'X-Figma-Token': this.figmaToken
                }
            });

            if (!response.ok) {
                throw new InvalidFigmaTokenError('Invalid Figma token');
            }
        } catch (error) {
            throw new InvalidFigmaTokenError('Failed to validate Figma token');
        }
    }

    validateUri(uri: string) {
        if (!uri.startsWith('figma:///')) {
            throw new InvalidUriError('Invalid Figma URI format');
        }
    }
}