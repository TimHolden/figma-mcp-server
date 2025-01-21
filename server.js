#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Get arguments
const args = process.argv.slice(2);
const useStdio = args.includes('--stdio');
const debug = args.includes('--debug') || process.env.DEBUG === 'true';

// Check for required token
const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
if (!figmaToken) {
    console.error('Error: FIGMA_ACCESS_TOKEN environment variable is required');
    process.exit(1);
}

// Import and run the appropriate entry point
try {
    if (useStdio) {
        const { default: runCli } = await import('./dist/claude.js');
        await runCli();
    } else {
        const { default: startServer } = await import('./dist/index.js');
        await startServer();
    }
} catch (error) {
    console.error('Fatal Error:', error);
    process.exit(1);
}

// Handle exit signals
process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nReceived SIGINT');
    process.exit(0);
});