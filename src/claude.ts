import { startServer } from './server.js';

async function main() {
    try {
        console.log('\n=== Starting Figma MCP Server (stdio mode) ===');
        
        const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
        if (!figmaToken) {
            throw new Error('FIGMA_ACCESS_TOKEN environment variable is required');
        }

        // Create and start server in stdio mode
        const server = await startServer(figmaToken, true);

        // Handle process signals
        process.on('SIGTERM', () => {
            console.log('\nReceived SIGTERM');
            server.stop().then(() => process.exit(0));
        });

        process.on('SIGINT', () => {
            console.log('\nReceived SIGINT');
            server.stop().then(() => process.exit(0));
        });

    } catch (error) {
        console.error('\nFatal Error:', error);
        process.exit(1);
    }
}

export default main;