// server.ts
import { WebSocket, WebSocketServer, RawData } from "ws";
import { createServer } from "http";
import { parse } from "url";
import { EventEmitter } from "events";

interface ConnectedClient {
  ws: WebSocket;
  type: "viewer" | "tracker";
  sessionId?: string;
  userId?: string;
  joinedAt: number;
  lastHeartbeat: number;
  watchingSessions: Set<string>;
}

interface SessionData {
  sessionId: string;
  userId: string;
  events: any[];
  metadata: {
    url: string;
    userAgent: string;
    viewport: { width: number; height: number; devicePixelRatio: number };
    startTime: number;
    lastActivity: number;
    referrer: string;
    timeZone: string;
  };
  isActive: boolean;
  errors: any[];
}

interface ServerStats {
  totalClients: number;
  activeSessions: number;
  viewers: number;
  trackers: number;
  totalEvents: number;
  uptime: number;
}

class SessionReplayServer extends EventEmitter {
  private wss: WebSocketServer;
  private clients = new Map<WebSocket, ConnectedClient>();
  private sessions = new Map<string, SessionData>();
  private port: number;
  private startTime: number;
  private heartbeatInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(port = 8080) {
    super();
    this.port = port;
    this.startTime = Date.now();

    const server = createServer();

    this.wss = new WebSocketServer({
      server,
      path: "/ws",
      perMessageDeflate: {
        zlibDeflateOptions: {
          level: 3,
          chunkSize: 1024,
        },
        threshold: 1024,
      },
    });

    this.setupWebSocketHandlers();
    this.startPeriodicTasks();

    server.listen(port, () => {
      console.log(`🚀 Session Replay Server running on port ${port}`);
      console.log(`📊 WebSocket endpoint: ws://localhost:${port}/ws`);
    });
  }

  private setupWebSocketHandlers(): void {
    this.wss.on("connection", (ws, request) => {
      const { query } = parse(request.url || "", true);
      const clientType = (query.type as "viewer" | "tracker") || "tracker";
      const clientIp =
        request.headers["x-forwarded-for"] || request.connection.remoteAddress;

      const client: ConnectedClient = {
        ws,
        type: clientType,
        joinedAt: Date.now(),
        lastHeartbeat: Date.now(),
        watchingSessions: new Set(),
      };

      this.clients.set(ws, client);

      console.log(
        `✅ New ${clientType} connected from ${clientIp}. Total clients: ${this.clients.size}`
      );

      if (clientType === "viewer") {
        this.sendActiveSessions(ws);
      }

      ws.on("message", (data) => {
        this.handleMessage(ws, data);
      });

      ws.on("close", (code, reason) => {
        this.handleClientDisconnect(ws, code, reason.toString());
      });

      ws.on("error", (error) => {
        console.error("❌ WebSocket error:", error.message);
        this.clients.delete(ws);
      });

      ws.on("pong", () => {
        const client = this.clients.get(ws);
        if (client) {
          client.lastHeartbeat = Date.now();
        }
      });
    });
  }

  private handleMessage(ws: WebSocket, data: RawData): void {
    try {
      // Normalize RawData (Buffer | ArrayBuffer | Buffer[]) to string safely
      let payload: string;

      if (typeof data === "string") {
        payload = data;
      } else if (data instanceof Buffer) {
        payload = data.toString();
      } else if (Array.isArray(data)) {
        // Buffer[]
        payload = Buffer.concat(data).toString();
      } else if (data instanceof ArrayBuffer) {
        payload = Buffer.from(data).toString();
      } else {
        payload = String(data);
      }

      const message = JSON.parse(payload);
      const client = this.clients.get(ws);

      if (!client) return;

      // Update heartbeat
      client.lastHeartbeat = Date.now();

      switch (message.type) {
        case "session_start":
          this.handleSessionStart(ws, message.data);
          break;

        case "events_batch":
          this.handleEventsBatch(ws, message.data);
          break;

        case "session_end":
          this.handleSessionEnd(message.data.sessionId);
          break;

        case "viewer_join_session":
          this.handleViewerJoinSession(ws, message.data.sessionId);
          break;

        case "viewer_leave_session":
          this.handleViewerLeaveSession(ws, message.data.sessionId);
          break;

        case "get_active_sessions":
          this.sendActiveSessions(ws);
          break;

        case "get_session_events":
          this.handleGetSessionEvents(
            ws,
            message.data.sessionId,
            message.data.fromIndex
          );
          break;

        case "heartbeat":
          // Heartbeat already handled above
          break;

        case "error":
          this.handleClientError(ws, message.data);
          break;

        case "visibility_change":
        case "javascript_error":
        case "promise_rejection":
          this.handleSessionEvent(ws, message);
          break;

        default:
          console.log("⚠️  Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("❌ Error parsing message:", error);
      this.sendError(ws, "Invalid message format");
    }
  }

  private handleSessionStart(ws: WebSocket, data: any): void {
    const client = this.clients.get(ws);
    if (!client || client.type !== "tracker") return;

    client.sessionId = data.sessionId;
    client.userId = data.userId;

    const sessionData: SessionData = {
      sessionId: data.sessionId,
      userId: data.userId,
      events: [],
      metadata: data,
      isActive: true,
      errors: [],
    };

    this.sessions.set(data.sessionId, sessionData);

    // Notify all viewers about new session
    this.broadcastToViewers({
      type: "session_started",
      data: {
        sessionId: data.sessionId,
        userId: data.userId,
        metadata: sessionData.metadata,
      },
    });

    console.log(
      `🎬 Session started: ${data.sessionId} for user: ${data.userId}`
    );
    this.emit("sessionStarted", sessionData);
  }

  private handleEventsBatch(ws: WebSocket, data: any): void {
    const client = this.clients.get(ws);
    if (!client || client.type !== "tracker" || !client.sessionId) return;

    const session = this.sessions.get(client.sessionId);
    if (!session) return;

    const { events } = data;
    session.events.push(...events);
    session.metadata.lastActivity = Date.now();

    // Broadcast events to viewers watching this session
    this.broadcastToViewers(
      {
        type: "events_batch",
        data: {
          sessionId: client.sessionId,
          events,
        },
      },
      (viewerClient) => viewerClient.watchingSessions.has(client.sessionId!)
    );

    // Limit events per session to prevent memory issues
    if (session.events.length > 20000) {
      session.events = session.events.slice(-10000);
      console.log(
        `📦 Trimmed events for session ${client.sessionId} to prevent memory overflow`
      );
    }
  }

  private handleSessionEnd(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isActive = false;

    this.broadcastToViewers({
      type: "session_ended",
      data: { sessionId },
    });

    console.log(`🏁 Session ended: ${sessionId}`);
    this.emit("sessionEnded", session);
  }

  private handleViewerJoinSession(ws: WebSocket, sessionId: string): void {
    const client = this.clients.get(ws);
    const session = this.sessions.get(sessionId);

    if (!client || !session) {
      this.sendError(ws, "Session not found");
      return;
    }

    client.watchingSessions.add(sessionId);

    // Send initial session data to viewer
    ws.send(
      JSON.stringify({
        type: "session_joined",
        data: {
          sessionId,
          events: session.events.slice(-1000), // Send last 1000 events initially
          metadata: session.metadata,
          totalEvents: session.events.length,
          isActive: session.isActive,
        },
      })
    );

    console.log(`👀 Viewer joined session: ${sessionId}`);
  }

  private handleViewerLeaveSession(ws: WebSocket, sessionId: string): void {
    const client = this.clients.get(ws);
    if (!client) return;

    client.watchingSessions.delete(sessionId);
    console.log(`👋 Viewer left session: ${sessionId}`);
  }

  private handleGetSessionEvents(
    ws: WebSocket,
    sessionId: string,
    fromIndex = 0
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendError(ws, "Session not found");
      return;
    }

    const events = session.events.slice(fromIndex, fromIndex + 1000);

    ws.send(
      JSON.stringify({
        type: "session_events",
        data: {
          sessionId,
          events,
          fromIndex,
          totalEvents: session.events.length,
          hasMore: fromIndex + events.length < session.events.length,
        },
      })
    );
  }

  private handleClientError(ws: WebSocket, errorData: any): void {
    const client = this.clients.get(ws);
    if (!client || !client.sessionId) return;

    const session = this.sessions.get(client.sessionId);
    if (session) {
      session.errors.push(errorData);
    }

    console.error(`💥 Client error in session ${client.sessionId}:`, errorData);
  }

  private handleSessionEvent(ws: WebSocket, message: any): void {
    const client = this.clients.get(ws);
    if (!client || !client.sessionId) return;

    // Broadcast session events to watching viewers
    this.broadcastToViewers(message, (viewerClient) =>
      viewerClient.watchingSessions.has(client.sessionId!)
    );
  }

  private handleClientDisconnect(
    ws: WebSocket,
    code: number,
    reason: string
  ): void {
    const client = this.clients.get(ws);
    if (client) {
      console.log(`👋 ${client.type} disconnected (${code}: ${reason})`);

      if (client.type === "tracker" && client.sessionId) {
        this.handleSessionEnd(client.sessionId);
      }
    }

    this.clients.delete(ws);
  }

  private sendActiveSessions(ws: WebSocket): void {
    const activeSessions = Array.from(this.sessions.values())
      .filter((session) => session.isActive)
      .map((session) => ({
        sessionId: session.sessionId,
        userId: session.userId,
        metadata: session.metadata,
        eventCount: session.events.length,
        errorCount: session.errors.length,
      }));

    ws.send(
      JSON.stringify({
        type: "active_sessions",
        data: { sessions: activeSessions },
      })
    );
  }

  private broadcastToViewers(
    message: any,
    filter?: (client: ConnectedClient) => boolean
  ): void {
    const data = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (
        client.type === "viewer" &&
        client.ws.readyState === WebSocket.OPEN &&
        (!filter || filter(client))
      ) {
        try {
          client.ws.send(data);
        } catch (error) {
          console.error("Failed to send to viewer:", error);
        }
      }
    });
  }

  private sendError(ws: WebSocket, message: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "error",
          data: { message },
        })
      );
    }
  }

  private startPeriodicTasks(): void {
    // Heartbeat check every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.checkClientHeartbeats();
    }, 30000);

    // Cleanup old sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldSessions();
    }, 5 * 60 * 1000);
  }

  private checkClientHeartbeats(): void {
    const now = Date.now();
    const staleClients: WebSocket[] = [];

    this.clients.forEach((client, ws) => {
      const timeSinceLastHeartbeat = now - client.lastHeartbeat;

      if (timeSinceLastHeartbeat > 60000) {
        // 60 seconds
        console.log(`💀 Removing stale ${client.type} client`);
        staleClients.push(ws);
      } else if (ws.readyState === WebSocket.OPEN) {
        // Send ping to check if client is alive
        ws.ping();
      }
    });

    staleClients.forEach((ws) => {
      this.handleClientDisconnect(ws, 1001, "Heartbeat timeout");
      ws.terminate();
    });
  }

  private cleanupOldSessions(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const sessionsToDelete: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      const timeSinceLastActivity = now - session.metadata.lastActivity;

      if (!session.isActive && timeSinceLastActivity > maxAge) {
        sessionsToDelete.push(sessionId);
      }
    });

    sessionsToDelete.forEach((sessionId) => {
      this.sessions.delete(sessionId);
      console.log(`🧹 Cleaned up old session: ${sessionId}`);
    });

    if (sessionsToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${sessionsToDelete.length} old sessions`);
    }
  }

  public getStats(): ServerStats {
    const now = Date.now();
    const totalEvents = Array.from(this.sessions.values()).reduce(
      (sum, session) => sum + session.events.length,
      0
    );

    return {
      totalClients: this.clients.size,
      activeSessions: Array.from(this.sessions.values()).filter(
        (s) => s.isActive
      ).length,
      viewers: Array.from(this.clients.values()).filter(
        (c) => c.type === "viewer"
      ).length,
      trackers: Array.from(this.clients.values()).filter(
        (c) => c.type === "tracker"
      ).length,
      totalEvents,
      uptime: now - this.startTime,
    };
  }

  public shutdown(): void {
    console.log("🛑 Shutting down server...");

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.clients.forEach((client, ws) => {
      ws.close(1001, "Server shutdown");
    });

    this.wss.close();
    this.emit("shutdown");
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

// Start the server
const server = new SessionReplayServer(8080);

// Log stats every minute
setInterval(() => {
  const stats = server.getStats();
  console.log("📊 Server Stats:", stats);
}, 60000);

export default SessionReplayServer;
