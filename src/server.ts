import { EventEmitter } from 'events';
import os from 'os';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { FigmaHandler } from './handlers/figma.js';
import { ServerState, ServerStats } from './types.js';
import { Logger } from './logger.js';

interface ConnectionStats {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    peakMemoryUsage: number;
}

interface FigmaApiStats {
    totalApiCalls: number;
    failedApiCalls: number;
    averageApiLatency: number;
    rateLimitRemaining: number | undefined | null;
    rateLimitReset: number | undefined | null;
    lastError?: {
        message: string;
        time: number;
        endpoint: string;
    };
}

export class MCPServer extends EventEmitter {
    private readonly server: Server;
    private transport: StdioServerTransport | null = null;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private state: ServerState = 'starting';
    private startTime: number;
    private lastActivityTime: number;
    private connectionErrors: number = 0;
    private readonly defaultPort: number = 3000;
    private readonly debug: boolean;
    private port?: number;
    private figmaHandler: FigmaHandler;
    private readonly logger: Logger;

    private connectionStats: ConnectionStats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        peakMemoryUsage: 0
    };

    private figmaApiStats: FigmaApiStats = {
        totalApiCalls: 0,
        failedApiCalls: 0,
        averageApiLatency: 0,
        rateLimitRemaining: undefined,
        rateLimitReset: undefined
    };

    constructor(
        private readonly figmaToken: string,
        debug = false,
        port?: number
    ) {
        super();
        this.debug = debug;
        this.port = port;
        this.startTime = Date.now();
        this.lastActivityTime = Date.now();
        this.logger = new Logger(debug);

        // Initialize Figma handler with stats callback
        this.figmaHandler = new FigmaHandler(figmaToken, (stats) => {
            if (stats.totalApiCalls) {
                this.figmaApiStats.totalApiCalls += stats.totalApiCalls;
            }
            if (stats.failedApiCalls) {
                this.figmaApiStats.failedApiCalls += stats.failedApiCalls;
            }
            if (stats.apiResponseTimes) {
                const totalTime = stats.apiResponseTimes.reduce((a, b) => a + b, 0);
                this.figmaApiStats.averageApiLatency = totalTime / stats.apiResponseTimes.length;
            }
            if (stats.rateLimitRemaining !== undefined) {
                this.figmaApiStats.rateLimitRemaining = stats.rateLimitRemaining;
            }
            if (stats.rateLimitReset !== undefined) {
                this.figmaApiStats.rateLimitReset = stats.rateLimitReset;
            }
            if (stats.lastError) {
                this.figmaApiStats.lastError = stats.lastError;
            }
        });

        this.server = new Server(
            {
                name: "figma-mcp-server",
                version: "1.0.0"
            },
            {
                capabilities: {
                    tools: {}
                }
            }
        );

        // Set up request handlers
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: await this.figmaHandler.listTools()
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const startTime = Date.now();
            this.connectionStats.totalRequests++;
            
            try {
                const result = await this.figmaHandler.callTool(
                    request.params.name,
                    request.params.arguments
                );
                
                this.connectionStats.successfulRequests++;
                const responseTime = Date.now() - startTime;
                this.connectionStats.avgResponseTime = (
                    this.connectionStats.avgResponseTime * (this.connectionStats.successfulRequests - 1) +
                    responseTime
                ) / this.connectionStats.successfulRequests;
                
                return result;
            } catch (error) {
                this.connectionStats.failedRequests++;
                throw error;
            } finally {
                const currentMemory = process.memoryUsage().heapUsed;
                if (currentMemory > this.connectionStats.peakMemoryUsage) {
                    this.connectionStats.peakMemoryUsage = currentMemory;
                }
                this.lastActivityTime = Date.now();
            }
        });
    }

    private getHealthStatus() {
        const now = Date.now();
        return {
            state: this.state,
            uptime: Math.floor((now - this.startTime) / 1000),
            lastActivityTime: Math.floor((now - this.lastActivityTime) / 1000),
            connectionErrors: this.connectionErrors,
            isHealthy: this.state === 'running' && this.connectionErrors < 5,
            network: {
                localAddress: 'localhost',
                activePort: this.port || this.defaultPort,
                stdioTransportEnabled: Boolean(this.transport),
                sseTransportEnabled: false
            },
            connections: this.connectionStats,
            figmaApi: this.figmaApiStats,
            system: {
                cpuUsage: process.cpuUsage().user / 1000000,
                memoryUsage: {
                    used: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
                    total: Math.floor(os.totalmem() / 1024 / 1024)
                }
            }
        };
    }

    private handleError(error: Error): void {
        this.connectionErrors++;
        this.logger.error('Server error:', error);
        this.emit('error', error);
    }

    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(() => {
            const health = this.getHealthStatus();
            
            if (this.debug || !health.isHealthy) {
                this.logger.log('Health Status:', health);
            }
            
            this.emit('healthUpdate', health);
        }, 10000);
    }

    public async start(): Promise<void> {
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
            this.logger.info('Server started', {
                state: initHealth.state,
                health: initHealth.isHealthy,
                transport: 'stdio'
            });
            this.emit('healthUpdate', initHealth);
            
            this.logger.log('Initial health status:', initHealth);
        } catch (error) {
            this.state = 'error';
            if (error instanceof Error) {
                this.handleError(error);
            }
            throw error;
        }
    }

    public async stop(): Promise<void> {
        this.state = 'stopping';
        
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
        this.logger.info('Server stopped', {
            runtime: {
                uptime: finalHealth.uptime,
                requests: finalHealth.connections.totalRequests,
                successRate: (finalHealth.connections.successfulRequests / 
                            Math.max(finalHealth.connections.totalRequests, 1) * 100).toFixed(2) + '%',
                errors: this.connectionErrors
            }
        });
        
        if (this.debug) {
            this.logger.log('Final health status:', finalHealth);
        }
        
        this.emit('healthUpdate', finalHealth);
    }
}

export const startServer = async (
    figmaToken: string, 
    debug = false,
    port = 3000
): Promise<MCPServer> => {
    const logger = new Logger(debug);
    
    logger.info('Starting Figma MCP Server', {
        version: process.env.npm_package_version || '1.0.0',
        platform: `${os.platform()} (${os.release()})`,
        nodeVersion: process.version,
        config: {
            debug,
            port
        }
    });
    
    try {
        const server = new MCPServer(figmaToken, debug, port);
        await server.start();
        return server;
    } catch (error) {
        logger.error('Failed to start server:', error);
        throw error;
    }
}