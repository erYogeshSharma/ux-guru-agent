import { EventEmitter } from "events";
import { SessionService } from "@/services/SessionService";
import { logger } from "@/utils/logger";
import { config } from "@/config";

export interface ConnectedClient {
  ws: any; // Fastify WebSocket connection
  type: "viewer" | "tracker";
  sessionId?: string;
  userId?: string;
  organizationId?: string;
  joinedAt: number;
  lastHeartbeat: number;
  watchingSessions: Set<string>;
}

export class WebSocketService extends EventEmitter {
  private clients = new Map<WebSocket, ConnectedClient>();
  private sessionService: SessionService;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(sessionService: SessionService) {
    super();
    this.sessionService = sessionService;
    this.startHeartbeatCheck();
    this.setupSessionListeners();
  }

  private setupSessionListeners(): void {
    this.sessionService.on("sessionStarted", (session) => {
      this.broadcastToViewers({
        type: "session_started",
        data: {
          sessionId: session.sessionId,
          userId: session.userId,
          organizationId: session.organizationId,
          metadata: session.metadata,
        },
      });
    });

    this.sessionService.on("sessionEnded", (session) => {
      this.broadcastToViewers({
        type: "session_ended",
        data: { sessionId: session.sessionId },
      });
    });

    this.sessionService.on("eventsAdded", ({ sessionId, events }) => {
      this.broadcastToViewers({
        type: "events_added",
        data: { sessionId, events },
      });
    });
  }

  public handleConnection(
    connection: any,
    clientType: "viewer" | "tracker",
    clientIp: string
  ): void {
    // In Fastify WebSocket, the connection object itself is the WebSocket-like object
    const ws = connection;

    if (!ws || typeof ws.on !== "function") {
      logger.error("Invalid WebSocket connection object", {
        connectionType: typeof connection,
        hasOn: typeof connection?.on,
        connectionKeys: Object.keys(connection || {}),
      });
      return;
    }

    const now = Date.now();

    const client: ConnectedClient = {
      ws,
      type: clientType,
      joinedAt: now,
      lastHeartbeat: now,
      watchingSessions: new Set(),
    };

    this.clients.set(ws, client);
    logger.info(`WebSocket client connected: ${clientType} from ${clientIp}`);

    // Set up message handling
    ws.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(ws, message);
      } catch (error) {
        logger.error("WebSocket message error:", error);
        this.sendError(ws, "Invalid message format");
      }
    });

    // Handle connection close
    ws.on("close", () => {
      this.handleDisconnection(ws);
    });

    // Handle connection errors
    ws.on("error", (error: Error) => {
      logger.error(`WebSocket error for ${clientType}:`, error);
      this.handleDisconnection(ws);
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: "connected",
      data: {
        clientType,
        timestamp: now,
        serverVersion: "3.0.0",
      },
    });
  }

  private async handleMessage(ws: WebSocket, message: any): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;

    try {
      switch (message.type) {
        case "heartbeat":
          client.lastHeartbeat = Date.now();
          this.sendMessage(ws, {
            type: "heartbeat_ack",
            timestamp: Date.now(),
          });
          break;

        case "session_start":
          console.log("Session MEssage Data", message.data);
          if (client.type === "tracker") {
            await this.handleSessionStart(client, message.data);
          }
          break;

        case "session_events":
          if (client.type === "tracker") {
            await this.handleSessionEvents(client, message.data);
          }
          break;

        case "session_end":
          if (client.type === "tracker") {
            await this.handleSessionEnd(client, message.data);
          }
          break;

        case "watch_session":
          if (client.type === "viewer") {
            this.handleWatchSession(client, message.data);
          }
          break;

        case "unwatch_session":
          if (client.type === "viewer") {
            this.handleUnwatchSession(client, message.data);
          }
          break;

        default:
          this.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error("WebSocket message processing error:", error);
      this.sendError(ws, "Failed to process message");
    }
  }

  private async handleSessionStart(
    client: ConnectedClient,
    data: any
  ): Promise<void> {
    const { sessionId, userId, organizationId, metadata } = data;

    if (!sessionId || !userId || !organizationId) {
      const missing = [];
      if (!sessionId) missing.push("sessionId");
      if (!userId) missing.push("userId");
      if (!organizationId) missing.push("organizationId");

      this.sendError(
        client.ws,
        `Missing required session data: ${missing.join(", ")}`
      );
      logger.warn(
        `Session start failed - missing data: ${missing.join(", ")}`,
        { data }
      );
      return;
    }

    client.sessionId = sessionId;
    client.userId = userId;
    client.organizationId = organizationId;

    // Create session in service
    try {
      await this.sessionService.createSession({
        id: sessionId,
        userId,
        organizationId,
        metadata: metadata || {},
      });

      // Add to memory for real-time features
      this.sessionService.setMemorySession(sessionId, {
        sessionId,
        userId,
        organizationId,
        events: [],
        errors: [],
        isActive: true,
        metadata: metadata || {},
      });

      this.sendMessage(client.ws, {
        type: "session_started",
        data: { sessionId },
      });

      logger.info(
        `Session started: ${sessionId} for user ${userId} (org: ${organizationId})`
      );
    } catch (error) {
      logger.error(`Session start error for ${sessionId}:`, error);
      this.sendError(client.ws, "Failed to start session");
    }
  }

  private async handleSessionEvents(
    client: ConnectedClient,
    data: any
  ): Promise<void> {
    const { sessionId, events } = data;

    if (!sessionId || !events || !Array.isArray(events)) {
      this.sendError(client.ws, "Invalid session events data");
      return;
    }

    if (client.sessionId !== sessionId) {
      this.sendError(client.ws, "Session ID mismatch");
      return;
    }

    try {
      // Add events to memory session
      const success = this.sessionService.addEventsToMemorySession(
        sessionId,
        events
      );
      if (!success) {
        // Try to recreate session in memory
        const dbSession = await this.sessionService.getSessionById(sessionId);
        if (dbSession) {
          this.sessionService.setMemorySession(sessionId, {
            sessionId: dbSession.id,
            userId: dbSession.userId,
            organizationId: dbSession.organizationId,
            metadata: dbSession.metadata,
            events: [],
            errors: [],
            isActive: dbSession.isActive,
          });
          this.sessionService.addEventsToMemorySession(sessionId, events);
        }
      }

      // Store events in database
      await this.sessionService.addSessionEvents(sessionId, events);

      this.sendMessage(client.ws, {
        type: "events_received",
        data: { sessionId, count: events.length },
      });
    } catch (error) {
      logger.error(`Session events error for ${sessionId}:`, error);
      this.sendError(client.ws, "Failed to process events");
    }
  }

  private async handleSessionEnd(
    client: ConnectedClient,
    data: any
  ): Promise<void> {
    const { sessionId } = data;

    if (!sessionId || client.sessionId !== sessionId) {
      this.sendError(client.ws, "Invalid session end request");
      return;
    }

    try {
      // Update session in database
      await this.sessionService.updateSession(sessionId, {
        isActive: false,
        endedAt: new Date(),
      });

      // Remove from memory
      this.sessionService.removeMemorySession(sessionId);

      this.sendMessage(client.ws, {
        type: "session_ended",
        data: { sessionId },
      });

      logger.info(`Session ended: ${sessionId}`);
    } catch (error) {
      logger.error(`Session end error for ${sessionId}:`, error);
      this.sendError(client.ws, "Failed to end session");
    }
  }

  private handleWatchSession(client: ConnectedClient, data: any): void {
    const { sessionId } = data;
    if (!sessionId) {
      this.sendError(client.ws, "Session ID required");
      return;
    }

    client.watchingSessions.add(sessionId);
    this.sendMessage(client.ws, {
      type: "watching_session",
      data: { sessionId },
    });
  }

  private handleUnwatchSession(client: ConnectedClient, data: any): void {
    const { sessionId } = data;
    if (!sessionId) {
      this.sendError(client.ws, "Session ID required");
      return;
    }

    client.watchingSessions.delete(sessionId);
    this.sendMessage(client.ws, {
      type: "unwatching_session",
      data: { sessionId },
    });
  }

  private handleDisconnection(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (!client) return;

    this.clients.delete(ws);
    logger.info(
      `WebSocket client disconnected: ${client.type} ${client.sessionId || ""}`
    );
  }

  private sendMessage(ws: any, message: any): void {
    try {
      // Check if connection is open (Fastify WebSocket might use different readyState values)
      if (ws && ws.readyState === 1) {
        // 1 = OPEN
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      logger.error("Failed to send WebSocket message:", error);
    }
  }

  private sendError(ws: any, error: string): void {
    this.sendMessage(ws, {
      type: "error",
      data: { message: error },
    });
  }

  private broadcastToViewers(message: any): void {
    for (const [ws, client] of this.clients) {
      if (client.type === "viewer" && ws.readyState === 1) {
        // 1 = OPEN
        ws.send(JSON.stringify(message));
      }
    }
  }

  private startHeartbeatCheck(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = config.heartbeatInterval * 2; // 2x heartbeat interval

      for (const [ws, client] of this.clients) {
        if (now - client.lastHeartbeat > timeout) {
          logger.info(
            `Client timeout: ${client.type} ${client.sessionId || ""}`
          );
          try {
            const wsAny = ws as any;
            if (wsAny.terminate) {
              wsAny.terminate();
            } else if (wsAny.close) {
              wsAny.close();
            }
          } catch (error) {
            logger.error("Error terminating WebSocket:", error);
          }
          this.clients.delete(ws);
        }
      }
    }, config.heartbeatInterval);
  }

  public getStats() {
    const totalClients = this.clients.size;
    let viewers = 0;
    let trackers = 0;

    for (const client of this.clients.values()) {
      if (client.type === "viewer") {
        viewers++;
      } else {
        trackers++;
      }
    }

    return {
      totalClients,
      viewers,
      trackers,
    };
  }

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    for (const [ws] of this.clients) {
      try {
        const wsAny = ws as any;
        if (wsAny.terminate) {
          wsAny.terminate();
        } else if (wsAny.close) {
          wsAny.close();
        }
      } catch (error) {
        logger.error("Error closing WebSocket during shutdown:", error);
      }
    }

    this.clients.clear();
    logger.info("WebSocket service shutdown complete");
  }
}
