import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { FigmaHandler } from './handlers/figma.js';
import { SessionManager } from './middleware/sessionManager.js';
import EventEmitter from 'events';

interface HealthStatus {
    state: 'starting' | 'running' | 'error' | 'stopped';
    uptime: number;
    lastHeartbeat: number;
    connectionErrors: number;
    isHealthy: boolean;
}

export class MCPServer extends EventEmitter {
    private server: Server;
    private transport: StdioServerTransport | null = null;
    private state: 'starting' | 'running' | 'error' | 'stopped' = 'starting';
    private startTime: number = Date.now();
    private lastActivityTime: number = Date.now();
    private connectionErrors: number = 0;
    private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
    private initialized: boolean = false;

    constructor(
        private figmaToken: string,
        private debug: boolean = false
    ) {
        super();
        
        this.server = new Server({
            name: "figma-mcp-server",
            version: "1.0.0"
        }, {
            capabilities: {
                tools: {}
            }
        });

        const figmaHandler = new FigmaHandler(figmaToken);
        const sessionManager = new SessionManager();

        // Set up request handlers
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            this.updateActivity();
            return {
                tools: await figmaHandler.listTools()
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            this.updateActivity();
            const { name, arguments: args } = request.params;
            return figmaHandler.callTool(name, args);
        });

        // Listen for transport errors
        if (this.transport) {
            this.transport.onerror = (error: Error) => {
                this.handleError(error);
            };
        }
    }

    private handleError(error: Error): void {
        this.connectionErrors++;
        this.state = 'error';
        console.error('Server error:', error);
        this.emit('healthUpdate', this.getHealthStatus());
    }

    private updateActivity(): void {
        this.lastActivityTime = Date.now();
        if (!this.initialized) {
            this.initialized = true;
            console.log('First activity detected - server is ready');
        }
    }

    public getHealthStatus(): HealthStatus {
        const uptime = Date.now() - this.startTime;
        const timeSinceLastActivity = Date.now() - this.lastActivityTime;
        
        return {
            state: this.state,
            uptime: Math.floor(uptime / 1000), // seconds
            lastHeartbeat: Math.floor(timeSinceLastActivity / 1000), // seconds since last activity
            connectionErrors: this.connectionErrors,
            isHealthy: this.state === 'running' && 
                      (timeSinceLastActivity < 30000 || !this.initialized) // Don't mark as unhealthy until first activity
        };
    }

    private startHealthCheck(): void {
        // Check health every 10 seconds
        this.healthCheckInterval = setInterval(() => {
            const health = this.getHealthStatus();
            if (this.debug || !health.isHealthy) {
                console.log('\nHealth status:', health);
            }
            this.emit('healthUpdate', health);
        }, 10000);
    }

    async start(): Promise<void> {
        try {
            this.transport = new StdioServerTransport();
            
            // Set up transport error handling
            this.transport.onerror = (error: Error) => {
                this.handleError(error);
            };

            await this.server.connect(this.transport);
            this.state = 'running';
            this.startHealthCheck();
            
            const initHealth = this.getHealthStatus();
            console.log('=== Server Health Status ===');
            console.log(JSON.stringify(initHealth, null, 2));
            this.emit('healthUpdate', initHealth);
            
            console.log('Server started in stdio mode');
            console.log('Waiting for first activity...');
        } catch (error) {
            this.state = 'error';
            if (error instanceof Error) {
                this.handleError(error);
            }
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        if (this.transport) {
            await this.server.connect(this.transport); // Reset connection
            this.transport = null;
        }
        this.state = 'stopped';
        
        const finalHealth = this.getHealthStatus();
        console.log('\n=== Final Server Health Status ===');
        console.log(JSON.stringify(finalHealth, null, 2));
        this.emit('healthUpdate', finalHealth);
    }
}

export const startServer = async (
    figmaToken: string, 
    debug = false
): Promise<MCPServer> => {
    console.log('\n=== Starting Figma MCP Server ===');
    
    try {
        const server = new MCPServer(figmaToken, debug);
        await server.start();
        return server;
    } catch (error) {
        console.error('Failed to start server:', error);
        throw error;
    }
}