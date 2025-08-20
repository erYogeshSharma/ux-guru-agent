/**
 * Centralized Session Manager
 * Unified interface for session data from both REST API and WebSocket
 * Keeps all session state synchronized and provides clean abstractions
 */

import { apiClient, type ApiSession } from "@/api/client";
import {
  sessionReplayStore,
  sessionReplayActions,
} from "@/store/sessionReplayStore";
import type { Session, eventWithTime } from "@/types";

interface SessionStartedData {
  sessionId: string;
  userId: string;
  metadata: Record<string, unknown>;
}

interface SessionJoinedData {
  sessionId: string;
  events?: eventWithTime[];
  isActive: boolean;
  totalEvents?: number;
}

interface SessionEventsData {
  sessionId: string;
  events: eventWithTime[];
  fromIndex: number;
  totalEvents: number;
  hasMore: boolean;
}

export interface SessionManagerConfig {
  wsUrl: string;
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  eventBatchSize: number;
}

export interface SessionEventRequest {
  sessionId: string;
  fromIndex?: number;
  limit?: number;
}

export interface LiveSessionState {
  sessionId: string;
  isActive: boolean;
  isLive: boolean;
  lastEventIndex: number;
  totalEvents: number;
}

class SessionManager {
  private ws: WebSocket | null = null;
  private config: SessionManagerConfig;
  private reconnectAttempts = 0;
  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private liveSessionStates = new Map<string, LiveSessionState>();

  constructor(config: SessionManagerConfig) {
    this.config = config;
  }

  // Initialize the manager - connects WebSocket and syncs initial data
  async initialize(): Promise<void> {
    try {
      // First, try to load initial data from REST API (optional)
      try {
        await this.syncInitialData();
      } catch (error) {
        console.warn(
          "⚠️ Failed to sync initial data from REST API, continuing with WebSocket only:",
          error
        );
        sessionReplayActions.setError(
          "Backend API not available - using WebSocket only"
        );
      }

      // Then establish WebSocket connection
      try {
        await this.connectWebSocket();
      } catch (error) {
        console.warn("⚠️ Failed to connect WebSocket, will retry:", error);
        sessionReplayActions.setError(
          "WebSocket connection failed - will retry"
        );
      }

      console.log("🚀 Session Manager initialized");
    } catch (error) {
      console.error("❌ Failed to initialize Session Manager:", error);
      sessionReplayActions.setError("Failed to initialize session manager");
    }
  }

  // Sync initial data from REST endpoints
  private async syncInitialData(): Promise<void> {
    try {
      // Load active sessions
      let convertedSessions: Session[] = [];
      try {
        const activeData = await apiClient.getActiveSessions();
        convertedSessions = activeData.sessions.map(
          this.convertApiSessionToSession
        );
      } catch (error) {
        console.warn("Failed to load active sessions from REST API:", error);
      }

      // Load session history (first page)
      let historySessions: Session[] = [];
      try {
        const historyData = await apiClient.getSessionHistory(50, 0);

        // Filter out currently active sessions from history to avoid duplicates
        const activeSessionIds = new Set(
          convertedSessions.map((s) => s.sessionId)
        );
        historySessions = historyData.sessions
          .filter((session) => !activeSessionIds.has(session.sessionId))
          .map(this.convertApiSessionToSession);
      } catch (error) {
        console.warn("Failed to load session history from REST API:", error);
      }

      // Update store with initial data
      sessionReplayActions.updateSessions(convertedSessions);
      sessionReplayActions.updateHistorySessions(historySessions);

      // Clear and rebuild live session states for only active sessions
      this.liveSessionStates.clear();
      const now = Date.now();

      // Initialize live session states for active sessions only
      convertedSessions.forEach((session) => {
        const lastActivity = session.metadata.lastActivity;

        // A session is "live" if it's been active in the last 2 minutes
        const isLive = lastActivity > now - 120000; // 2 minutes

        // A session is "active" if it's been active in the last 10 minutes
        const isActive = lastActivity > now - 600000; // 10 minutes

        this.liveSessionStates.set(session.sessionId, {
          sessionId: session.sessionId,
          isActive: isActive,
          isLive: isLive,
          lastEventIndex: session.eventCount,
          totalEvents: session.eventCount,
        });
      });

      console.log(
        `✅ Initial sync: ${convertedSessions.length} active, ${historySessions.length} historical sessions`
      );
    } catch (error) {
      console.error("Failed to sync initial data:", error);
      throw error;
    }
  }

  // Connect to WebSocket and set up handlers
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${this.config.wsUrl}?type=viewer`);

        this.ws.onopen = () => {
          console.log("🔌 WebSocket connected");
          this.reconnectAttempts = 0;
          sessionReplayActions.setReadyState(WebSocket.OPEN);

          // Request active sessions immediately
          this.sendMessage({ type: "get_active_sessions" });

          // Start heartbeat
          this.startHeartbeat();

          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleWebSocketMessage(event);
        };

        this.ws.onclose = () => {
          console.log("🔌 WebSocket disconnected");
          sessionReplayActions.setReadyState(WebSocket.CLOSED);
          this.stopHeartbeat();

          if (
            this.config.autoReconnect &&
            this.reconnectAttempts < this.config.maxReconnectAttempts
          ) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error("🔌 WebSocket error:", error);
          sessionReplayActions.setError("WebSocket connection error");
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // Handle WebSocket messages with proper state management
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "active_sessions":
          this.handleActiveSessions(message.data.sessions || []);
          break;

        case "session_started":
          this.handleSessionStarted(message.data);
          break;

        case "session_ended":
          this.handleSessionEnded(message.data.sessionId);
          break;

        case "events_batch":
          this.handleEventsBatch(message.data.sessionId, message.data.events);
          break;

        case "session_joined":
          this.handleSessionJoined(message.data);
          break;

        case "session_events":
          this.handleSessionEvents(message.data);
          break;

        case "error":
          sessionReplayActions.setError(message.data.message);
          break;
      }
    } catch (error) {
      console.error("❌ Error parsing WebSocket message:", error);
    }
  }

  // Handle active sessions from WebSocket
  private handleActiveSessions(apiSessions: ApiSession[]): void {
    const sessions = apiSessions.map(this.convertApiSessionToSession);
    sessionReplayActions.updateSessions(sessions);

    // Clear old live session states
    this.liveSessionStates.clear();

    // Update live session states for truly active sessions
    sessions.forEach((session) => {
      const now = Date.now();
      const lastActivity = session.metadata.lastActivity;

      // A session is "live" if it's been active in the last 2 minutes
      const isLive = lastActivity > now - 120000; // 2 minutes

      // A session is "active" if it's been active in the last 10 minutes
      const isActive = lastActivity > now - 600000; // 10 minutes

      this.liveSessionStates.set(session.sessionId, {
        sessionId: session.sessionId,
        isActive: isActive,
        isLive: isLive,
        lastEventIndex: session.eventCount,
        totalEvents: session.eventCount,
      });
    });

    console.log(
      `📊 Updated ${sessions.length} active sessions, ${this.liveSessionStates.size} with live states`
    );
  } // Handle new session started
  private handleSessionStarted(data: SessionStartedData): void {
    const metadata = data.metadata as Record<string, unknown>;
    const session: Session = {
      sessionId: data.sessionId,
      userId: data.userId,
      metadata: {
        url: (metadata.url as string) || "",
        userAgent: (metadata.userAgent as string) || "",
        startTime: (metadata.startTime as number) || Date.now(),
        lastActivity: Date.now(),
        viewport: (metadata.viewport as {
          width: number;
          height: number;
          devicePixelRatio: number;
        }) || { width: 1920, height: 1080, devicePixelRatio: 1 },
        referrer: (metadata.referrer as string) || "",
        timeZone: (metadata.timeZone as string) || "UTC",
      },
      eventCount: 0,
      errorCount: 0,
    };

    sessionReplayActions.addSession(session);

    // Add to live session states
    this.liveSessionStates.set(session.sessionId, {
      sessionId: session.sessionId,
      isActive: true,
      isLive: true,
      lastEventIndex: 0,
      totalEvents: 0,
    });
  }

  // Handle session ended
  private handleSessionEnded(sessionId: string): void {
    sessionReplayActions.removeSession(sessionId);

    // Update live session state
    const liveState = this.liveSessionStates.get(sessionId);
    if (liveState) {
      liveState.isActive = false;
      liveState.isLive = false;
    }
  }

  // Handle events batch for live streaming
  private handleEventsBatch(sessionId: string, events: eventWithTime[]): void {
    const currentSelected = sessionReplayStore.state.selectedSession;
    const isLive = sessionReplayStore.state.isLive;

    if (sessionId === currentSelected && isLive) {
      sessionReplayActions.addSessionEvents(events);
    }

    // Update live session state
    const liveState = this.liveSessionStates.get(sessionId);
    if (liveState) {
      liveState.lastEventIndex += events.length;
      liveState.totalEvents += events.length;
      liveState.isActive = true;
    }

    // Update session event count in store
    sessionReplayActions.updateSessionActivity(
      sessionId,
      Date.now(),
      liveState?.totalEvents || 0
    );
  }

  // Handle session joined response
  private handleSessionJoined(data: SessionJoinedData): void {
    const { sessionId, events, isActive } = data;

    if (sessionId === sessionReplayStore.state.selectedSession) {
      sessionReplayActions.setSessionEvents(events || []);
      sessionReplayActions.setIsLive(isActive);
      sessionReplayActions.setLoading(false);

      // If no events provided, request them
      if (!events || events.length === 0) {
        this.requestSessionEvents({ sessionId, fromIndex: 0, limit: 1000 });
      }
    }
  }

  // Handle session events response
  private handleSessionEvents(data: SessionEventsData): void {
    const { sessionId, events, fromIndex, totalEvents } = data;

    if (sessionId === sessionReplayStore.state.selectedSession) {
      if (fromIndex === 0) {
        // Initial load
        sessionReplayActions.setSessionEvents(events);
        sessionReplayActions.setLoading(false);
      } else {
        // Pagination
        sessionReplayActions.addSessionEvents(events);
      }

      // Update live session state
      const liveState = this.liveSessionStates.get(sessionId);
      if (liveState) {
        liveState.totalEvents = totalEvents;
      }
    }
  }

  // Public API methods

  // Join a session for viewing (live or historical)
  async joinSession(
    sessionId: string,
    isLiveSession: boolean = true
  ): Promise<void> {
    try {
      sessionReplayActions.setSelectedSession(sessionId);
      sessionReplayActions.setLoading(true);
      sessionReplayActions.setError(null);
      sessionReplayActions.setSessionEvents([]);

      if (isLiveSession) {
        // For live sessions, use WebSocket
        sessionReplayActions.setIsLive(true);
        this.sendMessage({
          type: "viewer_join_session",
          data: { sessionId },
        });
      } else {
        // For historical sessions, use REST API
        sessionReplayActions.setIsLive(false);
        const eventData = await apiClient.getSessionEvents(sessionId, 0, 1000);

        // Convert API events to rrweb events
        const rrwebEvents = this.convertApiEventsToRRWeb(eventData.events);
        sessionReplayActions.setSessionEvents(rrwebEvents);
        sessionReplayActions.setLoading(false);
      }
    } catch (error) {
      console.error("❌ Failed to join session:", error);
      sessionReplayActions.setError("Failed to join session");
      sessionReplayActions.setLoading(false);
    }
  }

  // Leave current session
  leaveSession(): void {
    const currentSession = sessionReplayStore.state.selectedSession;
    if (currentSession) {
      this.sendMessage({
        type: "viewer_leave_session",
        data: { sessionId: currentSession },
      });
    }

    sessionReplayActions.setSelectedSession(null);
    sessionReplayActions.setSessionEvents([]);
    sessionReplayActions.setIsLive(false);
    sessionReplayActions.setLoading(false);
  }

  // Request session events (for pagination)
  requestSessionEvents(request: SessionEventRequest): void {
    this.sendMessage({
      type: "get_session_events",
      data: {
        sessionId: request.sessionId,
        fromIndex: request.fromIndex || 0,
        limit: request.limit || 1000,
      },
    });
  }

  // Get session status (active/inactive)
  getSessionStatus(sessionId: string): { isActive: boolean; isLive: boolean } {
    const liveState = this.liveSessionStates.get(sessionId);
    return {
      isActive: liveState?.isActive || false,
      isLive: liveState?.isLive || false,
    };
  }

  // Refresh active sessions (force sync)
  async refreshActiveSessions(): Promise<void> {
    try {
      const data = await apiClient.getActiveSessions();
      this.handleActiveSessions(data.sessions);
    } catch (error) {
      console.error("❌ Failed to refresh active sessions:", error);
    }
  }

  // Utility methods

  private sendMessage(message: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendMessage({ type: "heartbeat" });
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, 10000);
    this.reconnectAttempts++;

    setTimeout(() => {
      console.log(
        `🔄 Attempting reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`
      );
      this.connectWebSocket().catch(() => {
        // Reconnect failed, will be handled by onclose
      });
    }, delay);
  }

  // Convert API session to internal format
  private convertApiSessionToSession(apiSession: ApiSession): Session {
    return {
      sessionId: apiSession.sessionId,
      userId: apiSession.userId,
      metadata: {
        url: apiSession.metadata.url || "",
        userAgent: apiSession.metadata.userAgent || "",
        viewport: apiSession.metadata.viewport || {
          width: 1920,
          height: 1080,
          devicePixelRatio: 1,
        },
        startTime: apiSession.metadata.startTime || 0,
        lastActivity: apiSession.metadata.lastActivity || 0,
        referrer: apiSession.metadata.referrer || "",
        timeZone: apiSession.metadata.timeZone || "UTC",
      },
      eventCount: apiSession.eventCount,
      errorCount: apiSession.errorCount || 0,
    };
  }

  // Convert API events to rrweb format
  private convertApiEventsToRRWeb(apiEvents: unknown[]): eventWithTime[] {
    // This needs to be implemented based on how events are stored in the backend
    // For now, assume they're already in rrweb format
    return apiEvents as eventWithTime[];
  }

  // Cleanup
  destroy(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.liveSessionStates.clear();
  }
}

// Export singleton instance
export const sessionManager = new SessionManager({
  wsUrl: "ws://localhost:8080/ws",
  autoReconnect: true,
  maxReconnectAttempts: 5,
  eventBatchSize: 100,
});

export default SessionManager;
