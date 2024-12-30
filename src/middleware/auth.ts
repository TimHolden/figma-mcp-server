import { InvalidFigmaTokenError, InvalidUriError } from '../errors.js';

export const validateToken = () => {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) {
    throw new InvalidFigmaTokenError();
  }
  return token;
};

export const validateUri = (uri: string) => {
  const match = uri.match(/^figma:\/\/\/(file|component|variable)\/([\w-]+)(\/([\w-]+))?$/);
  if (!match) {
    throw new InvalidUriError(uri);
  }
  return {
    type: match[1] as 'file' | 'component' | 'variable',
    fileKey: match[2],
    resourceId: match[4]
  };
};