import dotenv from 'dotenv';
import { startServer } from './server.js';
import type { MCPServer } from './server.js';

dotenv.config();

const main = async (): Promise<MCPServer> => {
    const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
    if (!figmaToken) {
        throw new Error('FIGMA_ACCESS_TOKEN environment variable is required');
    }

    try {
        const server = await startServer(figmaToken, true);
        
        // Handle cleanup
        process.on('SIGINT', async () => {
            console.log('\nShutting down...');
            await server.stop();
            process.exit(0);
        });
        
        return server;
    } catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
};

if (import.meta.url.startsWith('file:')) {
    main().catch(error => {
        console.error('Fatal Error:', error);
        process.exit(1);
    });
}

export default main;