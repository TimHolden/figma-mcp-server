export class SessionManager {
    private sessions: Map<string, any> = new Map();

    async handleConnection(connectionId: string) {
        this.sessions.set(connectionId, {
            createdAt: Date.now(),
            lastActivity: Date.now()
        });
    }

    async handleDisconnection(connectionId: string) {
        this.sessions.delete(connectionId);
    }

    async handleCleanup() {
        const now = Date.now();
        for (const [connectionId, session] of this.sessions.entries()) {
            if (now - session.lastActivity > 30 * 60 * 1000) { // 30 minutes
                await this.handleDisconnection(connectionId);
            }
        }
    }
}