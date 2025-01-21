import { EventEmitter } from 'events';
import os from 'os';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { FigmaHandler } from './handlers/figma.js';
import { ServerState, ServerStats } from './types.js';

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
    rateLimitRemaining: number | undefined | null;  // Updated to match FigmaHandler stats
    rateLimitReset: number | undefined | null;      // Updated to match FigmaHandler stats
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
        console.error('Server error:', error);
        this.emit('error', error);
    }

    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(() => {
            const health = this.getHealthStatus();
            
            const serverSuccessRate = this.connectionStats.totalRequests > 0 
                ? (this.connectionStats.successfulRequests / this.connectionStats.totalRequests * 100).toFixed(2)
                : "N/A";
            
            const figmaSuccessRate = this.figmaApiStats.totalApiCalls > 0
                ? ((this.figmaApiStats.totalApiCalls - this.figmaApiStats.failedApiCalls) / 
                   this.figmaApiStats.totalApiCalls * 100).toFixed(2)
                : "N/A";

            if (this.debug || !health.isHealthy) {
                console.log('\nHealth Status Report:');
                console.log('-------------------');
                console.log(`Server State: ${health.state}`);
                console.log(`Uptime: ${health.uptime}s`);
                console.log(`Time Since Last Activity: ${health.lastActivityTime}s`);
                console.log(`Connection Errors: ${health.connectionErrors}`);
                console.log(`Healthy: ${health.isHealthy}`);
                
                console.log('\nNetwork Status:');
                console.log(`Local Address: ${health.network.localAddress}`);
                console.log(`Active Port: ${health.network.activePort}`);
                console.log(`STDIO Transport: ${health.network.stdioTransportEnabled ? 'Enabled' : 'Disabled'}`);
                console.log(`SSE Transport: ${health.network.sseTransportEnabled ? 'Enabled' : 'Disabled'}`);
                
                console.log('\nConnection Statistics:');
                console.log(`Total Requests: ${health.connections.totalRequests}`);
                console.log(`Server Success Rate: ${serverSuccessRate}%`);
                console.log(`Average Response Time: ${Math.round(health.connections.avgResponseTime)}ms`);
                console.log(`Peak Memory Usage: ${health.connections.peakMemoryUsage}MB`);
                
                console.log('\nFigma API Status:');
                console.log(`Total API Calls: ${health.figmaApi.totalApiCalls}`);
                console.log(`API Success Rate: ${figmaSuccessRate}%`);
                console.log(`Average API Latency: ${Math.round(health.figmaApi.averageApiLatency)}ms`);
                console.log(`Rate Limit Remaining: ${health.figmaApi.rateLimitRemaining ?? 'Unknown'}`);
                if (health.figmaApi.rateLimitReset) {
                    console.log(`Rate Limit Resets: ${new Date(health.figmaApi.rateLimitReset).toLocaleString()}`);
                }
                if (health.figmaApi.lastError) {
                    console.log(`Last Error: ${health.figmaApi.lastError.message}`);
                    console.log(`Last Error Time: ${new Date(health.figmaApi.lastError.time).toLocaleString()}`);
                    console.log(`Failed Endpoint: ${health.figmaApi.lastError.endpoint}`);
                }
                
                console.log('\nSystem Status:');
                console.log(`CPU Usage: ${(health.system.cpuUsage * 100).toFixed(1)}%`);
                console.log(`Memory: ${health.system.memoryUsage.used}MB used of ${health.system.memoryUsage.total}MB total`);
                console.log('-------------------');
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
        console.log('\n=== Final Server Health Status ===');
        console.log('Connection Summary:');
        console.log(`Total Requests Handled: ${this.connectionStats.totalRequests}`);
        console.log(`Successful Requests: ${this.connectionStats.successfulRequests}`);
        console.log(`Failed Requests: ${this.connectionStats.failedRequests}`);
        
        console.log('\nFigma API Summary:');
        console.log(`Total API Calls: ${this.figmaApiStats.totalApiCalls}`);
        console.log(`Failed API Calls: ${this.figmaApiStats.failedApiCalls}`);
        console.log(`Average API Latency: ${Math.round(this.figmaApiStats.averageApiLatency)}ms`);
        
        console.log('\nNetwork Summary:');
        console.log(`Active Port: ${this.port || this.defaultPort}`);
        console.log(`STDIO Transport Active: ${Boolean(this.transport)}`);
        
        console.log('\nPerformance Summary:');
        console.log(`Peak Memory Usage: ${Math.round(this.connectionStats.peakMemoryUsage / (1024 * 1024))}MB`);
        console.log(`Average Response Time: ${Math.round(this.connectionStats.avgResponseTime)}ms`);
        console.log(`Total Connection Errors: ${this.connectionErrors}`);
        console.log(`Total Uptime: ${Math.round((Date.now() - this.startTime) / 1000)}s`);
        
        if (finalHealth.figmaApi.lastError) {
            console.log('\nLast Recorded Error:');
            console.log(`Time: ${new Date(finalHealth.figmaApi.lastError.time).toLocaleString()}`);
            console.log(`Message: ${finalHealth.figmaApi.lastError.message}`);
            console.log(`Endpoint: ${finalHealth.figmaApi.lastError.endpoint}`);
        }
        
        console.log('\nServer stopped successfully');
        this.emit('healthUpdate', finalHealth);
    }
}

export const startServer = async (
    figmaToken: string, 
    debug = false,
    port = 3000
): Promise<MCPServer> => {
    console.log('\n=== Starting Figma MCP Server ===');
    console.log(`Version: ${process.env.npm_package_version || '1.0.0'}`);
    console.log(`Port: ${port}`);
    console.log(`Debug Mode: ${debug ? 'Enabled' : 'Disabled'}`);
    console.log(`Platform: ${os.platform()} (${os.release()})`);
    console.log(`Node Version: ${process.version}`);
    
    try {
        const server = new MCPServer(figmaToken, debug, port);
        await server.start();
        return server;
    } catch (error) {
        console.error('\nFailed to start server:', error);
        throw error;
    }
}