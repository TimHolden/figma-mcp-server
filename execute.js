#!/usr/bin/env node
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use the Claude-specific entry point
const claudePath = resolve(__dirname, 'dist/claude.js');

console.log('Starting Claude MCP server from:', claudePath);

const server = spawn('node', [claudePath], {
    // Use pipe for proper MCP communication
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
    cwd: __dirname
});

// Pipe stdio for MCP communication
process.stdin.pipe(server.stdin);
server.stdout.pipe(process.stdout);
server.stderr.pipe(process.stderr);

// Forward signals to the child process
process.on('SIGTERM', () => server.kill('SIGTERM'));
process.on('SIGINT', () => server.kill('SIGINT'));

// Handle server process events
server.on('error', (error) => {
    console.error('Server process error:', error);
    process.exit(1);
});

server.on('close', (code) => {
    console.log('Server process closed with code:', code);
    process.exit(code || 0);
});