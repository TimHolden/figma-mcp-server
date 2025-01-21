import { IncomingMessage, ServerResponse } from 'http';

export function validateMCPHeaders(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
) {
    const sessionId = req.headers['x-mcp-session'];
    
    if (!sessionId) {
        res.writeHead(400);
        res.end(JSON.stringify({
            error: 'Missing X-MCP-Session header',
            code: 'INVALID_HEADERS'
        }));
        return;
    }

    next();
}