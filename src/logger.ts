/**
 * Custom logger that ensures all debug output goes to stderr
 */
export class Logger {
    constructor(private readonly debugEnabled: boolean = false) {}

    info(...args: any[]): void {
        process.stderr.write(this.formatMessage('info', ...args));
    }

    error(...args: any[]): void {
        process.stderr.write(this.formatMessage('error', ...args));
    }

    log(...args: any[]): void {
        if (this.debugEnabled) {
            process.stderr.write(this.formatMessage('debug', ...args));
        }
    }

    private formatMessage(level: string, ...args: any[]): string {
        const timestamp = new Date().toISOString();
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        return `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    }
}