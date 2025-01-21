export class ResourceNotFoundError extends Error {
    constructor(message: string = 'Resource not found') {
        super(message);
        this.name = 'ResourceNotFoundError';
    }
}

export class InvalidFigmaTokenError extends Error {
    constructor(message: string = 'Invalid Figma token') {
        super(message);
        this.name = 'InvalidFigmaTokenError';
    }
}

export class InvalidUriError extends Error {
    constructor(message: string = 'Invalid URI') {
        super(message);
        this.name = 'InvalidUriError';
    }
}