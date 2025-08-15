import { EventEmitter } from "events";
import { WebSocket } from "ws";
import { ConnectedClient } from "../types";
import { config } from "../config";
import { connectionLogger } from "../utils/logger";
import SessionService from "./SessionService";

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

    client.sessionId = data.sessionId;
    client.userId = data.userId;

    this.sessionService.createSession({
      sessionId: data.sessionId,
      userId: data.userId,
      metadata: data,
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
    const client = this.clients.get(ws);
    const session = this.sessionService.getSession(sessionId);

    if (!client || !session) {
      this.sendError(ws, "Session not found");
      return;
    }

    client.watchingSessions.add(sessionId);

    ws.send(
      JSON.stringify({
        type: "session_joined",
        data: {
          sessionId,
          events: session.events.slice(-1000),
          metadata: session.metadata,
          totalEvents: session.events.length,
          isActive: session.isActive,
        },
      })
    );

    connectionLogger.viewerJoinedSession(sessionId);
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
    const events = this.sessionService.getSessionEvents(
      sessionId,
      fromIndex,
      1000
    );
    const session = this.sessionService.getSession(sessionId);

    if (!session) {
      this.sendError(ws, "Session not found");
      return;
    }

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
