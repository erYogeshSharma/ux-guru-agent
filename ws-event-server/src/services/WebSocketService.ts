import { EventEmitter } from "events";
import { WebSocket } from "ws";
import { ConnectedClient } from "../types";
import { config } from "../config";
import { connectionLogger } from "../utils/logger";
import SessionService from "./SessionService";
import { randomUUID } from "crypto";

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
      this.broadcastToViewers(
        {
          type: "events_batch",
          data: { sessionId, events },
        },
        (client) => client.watchingSessions.has(sessionId)
      );
    });
  }

  public handleConnection(
    ws: WebSocket,
    clientType: "viewer" | "tracker",
    clientIp: string
  ): void {
    const client: ConnectedClient = {
      ws,
      type: clientType,
      joinedAt: Date.now(),
      lastHeartbeat: Date.now(),
      watchingSessions: new Set(),
    };

    this.clients.set(ws, client);
    connectionLogger.clientConnected(clientType, clientIp, this.clients.size);

    if (clientType === "viewer") {
      this.sendActiveSessions(ws);
    }

    this.setupWebSocketHandlers(ws);
  }

  private setupWebSocketHandlers(ws: WebSocket): void {
    ws.on("message", (data) => {
      this.handleMessage(ws, data);
    });

    ws.on("close", (code, reason) => {
      this.handleClientDisconnect(ws, code, reason.toString());
    });

    ws.on("error", (error) => {
      connectionLogger.staleClientRemoved(`WebSocket error: ${error.message}`);
      this.clients.delete(ws);
    });

    ws.on("pong", () => {
      const client = this.clients.get(ws);
      if (client) {
        client.lastHeartbeat = Date.now();
      }
    });
  }

  private handleMessage(ws: WebSocket, data: any): void {
    try {
      let payload: string;

      if (typeof data === "string") {
        payload = data;
      } else if (data instanceof Buffer) {
        payload = data.toString();
      } else if (Array.isArray(data)) {
        payload = Buffer.concat(data).toString();
      } else if (data instanceof ArrayBuffer) {
        payload = Buffer.from(data).toString();
      } else {
        payload = String(data);
      }

      const message = JSON.parse(payload);
      const client = this.clients.get(ws);

      if (!client) return;

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
          connectionLogger.staleClientRemoved(
            `Unknown message type: ${message.type}`
          );
      }
    } catch (error) {
      connectionLogger.staleClientRemoved(`Error parsing message: ${error}`);
      this.sendError(ws, "Invalid message format");
    }
  }

  private handleSessionStart(ws: WebSocket, data: any): void {
    const client = this.clients.get(ws);
    if (!client || client.type !== "tracker") return;

    // Always use the client-provided sessionId if it's unique
    // Each tracker instance should generate its own unique sessionId
    let incomingId = data.sessionId as string | undefined;
    const userId =
      data.userId ||
      `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if this exact session already exists and is active
    const existing = incomingId
      ? this.sessionService.getSession(incomingId)
      : undefined;

    let assignedId = incomingId;

    // Only generate a new ID if:
    // 1. No sessionId was provided, OR
    // 2. The provided sessionId conflicts with an active session from a different client
    if (
      !incomingId ||
      (existing && existing.isActive && client.sessionId !== incomingId)
    ) {
      assignedId = `s_${Date.now()}_${randomUUID()}`;

      connectionLogger.staleClientRemoved(
        `Session ID conflict or missing. Generated new ID: ${assignedId} (original: ${incomingId})`
      );

      // Inform tracker of assigned session id so it can switch.
      try {
        ws.send(
          JSON.stringify({
            type: "session_assigned",
            data: { sessionId: assignedId },
          })
        );
      } catch (err) {
        connectionLogger.staleClientRemoved(
          `Failed to send session_assigned: ${err}`
        );
      }
    } else {
      // Use the provided session ID
      connectionLogger.staleClientRemoved(
        `Using client-provided session ID: ${assignedId}`
      );
    }

    client.sessionId = assignedId;
    client.userId = userId;

    // Create or update the session
    this.sessionService.createSession({
      sessionId: assignedId!,
      userId: userId,
      metadata: {
        ...data,
        startTime: Date.now(),
        lastActivity: Date.now(),
        clientConnectedAt: client.joinedAt,
      },
    });
  }

  private handleEventsBatch(ws: WebSocket, data: any): void {
    const client = this.clients.get(ws);
    if (!client || client.type !== "tracker" || !client.sessionId) return;

    const { events } = data;
    this.sessionService.addEventsToSession(client.sessionId, events);
  }

  private handleSessionEnd(sessionId: string): void {
    this.sessionService.endSession(sessionId);
  }

  private handleViewerJoinSession(ws: WebSocket, sessionId: string): void {
    (async () => {
      const client = this.clients.get(ws);

      if (!client) {
        this.sendError(ws, "Session not found");
        return;
      }

      client.watchingSessions.add(sessionId);

      // Try to get initial metadata and first chunk of events.
      const session = this.sessionService.getSession(sessionId);

      let totalEvents = 0;
      let metadata = session ? session.metadata : {};
      let isActive = session ? session.isActive : false;

      if (session) {
        totalEvents = session.events.length;
      } else {
        // If session not in memory, ask DB for stats via getSession (not present)
        // Fallback: request first page of events to infer counts
        const events = await this.sessionService.getSessionEvents(
          sessionId,
          0,
          1000
        );
        totalEvents = events.length;
      }

      // Send an initial joined message with metadata and counts. Do not include
      // the full event list to avoid huge payloads.
      ws.send(
        JSON.stringify({
          type: "session_joined",
          data: {
            sessionId,
            events: [], // viewer will request pages via get_session_events
            metadata,
            totalEvents,
            isActive,
          },
        })
      );

      connectionLogger.viewerJoinedSession(sessionId);
    })();
  }

  private handleViewerLeaveSession(ws: WebSocket, sessionId: string): void {
    const client = this.clients.get(ws);
    if (!client) return;

    client.watchingSessions.delete(sessionId);
    connectionLogger.viewerLeftSession(sessionId);
  }

  private handleGetSessionEvents(
    ws: WebSocket,
    sessionId: string,
    fromIndex = 0
  ): void {
    (async () => {
      try {
        const limit = 1000;
        const events = await this.sessionService.getSessionEvents(
          sessionId,
          fromIndex,
          limit
        );

        // Try to get total count from in-memory session, else estimate from DB
        const session = this.sessionService.getSession(sessionId);
        const totalEvents = session
          ? session.events.length
          : fromIndex + events.length;

        ws.send(
          JSON.stringify({
            type: "session_events",
            data: {
              sessionId,
              events,
              fromIndex,
              totalEvents,
              hasMore: fromIndex + events.length < totalEvents,
            },
          })
        );
      } catch (error) {
        this.sendError(ws, "Session not found");
      }
    })();
  }

  private handleClientError(ws: WebSocket, errorData: any): void {
    const client = this.clients.get(ws);
    if (!client || !client.sessionId) return;

    this.sessionService.addErrorToSession(client.sessionId, errorData);
  }

  private handleSessionEvent(ws: WebSocket, message: any): void {
    const client = this.clients.get(ws);
    if (!client || !client.sessionId) return;

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
      connectionLogger.clientDisconnected(client.type, code, reason);

      if (client.type === "tracker" && client.sessionId) {
        this.sessionService.endSession(client.sessionId);
      }
    }

    this.clients.delete(ws);
  }

  private sendActiveSessions(ws: WebSocket): void {
    const activeSessions = this.sessionService
      .getAllActiveSessions()
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
          connectionLogger.staleClientRemoved(
            `Failed to send to viewer: ${error}`
          );
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

  private startHeartbeatCheck(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkClientHeartbeats();
    }, config.heartbeatInterval);
  }

  private checkClientHeartbeats(): void {
    const now = Date.now();
    const staleClients: WebSocket[] = [];

    this.clients.forEach((client, ws) => {
      const timeSinceLastHeartbeat = now - client.lastHeartbeat;

      if (timeSinceLastHeartbeat > 60000) {
        connectionLogger.staleClientRemoved(client.type);
        staleClients.push(ws);
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });

    staleClients.forEach((ws) => {
      this.handleClientDisconnect(ws, 1001, "Heartbeat timeout");
      ws.terminate();
    });
  }

  public getStats() {
    return {
      totalClients: this.clients.size,
      viewers: Array.from(this.clients.values()).filter(
        (c) => c.type === "viewer"
      ).length,
      trackers: Array.from(this.clients.values()).filter(
        (c) => c.type === "tracker"
      ).length,
    };
  }

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.clients.forEach((client, ws) => {
      ws.close(1001, "Server shutdown");
    });

    this.emit("shutdown");
  }
}

export default WebSocketService;
