// tracker.ts
import { record } from "rrweb";
import type { eventWithTime } from "@rrweb/types";

interface TrackerConfig {
  wsUrl: string;
  sessionId?: string;
  userId?: string;
  debug?: boolean;
  recordOptions?: Partial<any>;
  batchSize?: number;
  flushInterval?: number;
}

interface SessionMetadata {
  sessionId: string;
  userId: string;
  url: string;
  userAgent: string;
  timestamp: number;
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  referrer: string;
  timeZone: string;
}

class SessionTracker {
  private ws: WebSocket | null = null;
  private config: Required<TrackerConfig>;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventQueue: eventWithTime[] = [];
  private stopRecording: (() => void) | null = null;
  // Use number|null for browser timer IDs
  private heartbeatInterval: number | null = null;
  private flushTimeout: number | null = null;
  private isRecording = false;

  constructor(config: TrackerConfig) {
    this.config = {
      sessionId: this.generateSessionId(),
      userId: this.initUserId(),
      debug: true,
      batchSize: 20,
      flushInterval: 500,
      recordOptions: {},
      ...config,
    };

    this.init();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initUserId(): string {
    let userId = localStorage.getItem("tracker_user_id");
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("tracker_user_id", userId);
    }
    return userId;
  }

  private init(): void {
    this.connectWebSocket();
    this.startRecording();
    this.setupLifecycleHandlers();
    this.startHeartbeat();
  }

  private connectWebSocket(): void {
    try {
      this.ws = new WebSocket(`${this.config.wsUrl}?type=tracker`);

      this.ws.onopen = () => {
        this.log("WebSocket connected");
        this.reconnectAttempts = 0;
        this.sendSessionMetadata();
        this.flushEventQueue();
      };

      this.ws.onclose = (event) => {
        this.log("WebSocket disconnected:", event.code, event.reason);
        this.reconnect();
      };

      this.ws.onerror = (error) => {
        this.log("WebSocket error:", error);
      };
    } catch (error) {
      this.log("Failed to connect WebSocket:", error);
      this.reconnect();
    }
  }

  private reconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        30000
      );

      this.log(
        `Attempting to reconnect in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      setTimeout(() => {
        this.connectWebSocket();
      }, delay);
    } else {
      this.log("Max reconnection attempts reached. Stopping tracker.");
      this.stop();
    }
  }

  private startRecording(): void {
    if (this.isRecording) return;

    const defaultOptions: any = {
      maskAllInputs: true,
      maskInputOptions: {
        password: true,
        email: false,
        tel: false,
        text: false,
      },
      maskTextFn: (text: string, element?: Element | null) => {
        // Mask sensitive text content
        if (element?.tagName?.toLowerCase() === "input") {
          return "*".repeat(text.length);
        }
        return text;
      },
      slimDOMOptions: {
        script: true,
        comment: true,
        headFavicon: true,
        headWhitespace: true,
        headMetaSocial: true,
        headMetaRobots: true,
        headMetaHttpEquiv: true,
        headMetaVerification: true,
      },
      recordCanvas: false,
      recordCrossOriginIframes: false,
      inlineStylesheet: true,
      inlineImages: false,
      collectFonts: false,
      userTriggeredOnInput: true,
      sampling: {
        scroll: 250,
        mousemove: 50,
        mouseInteraction: true,
        input: "last",
      },
      errorHandler: (error: any) => {
        this.log("Recording error:", error);
        this.sendMessage({
          type: "error",
          data: {
            sessionId: this.config.sessionId,
            error: error?.message || String(error),
            stack: error?.stack,
            timestamp: Date.now(),
          },
        });
      },
    };

    const recordOptions = { ...defaultOptions, ...this.config.recordOptions };

    const stopHandler = record({
      ...recordOptions,
      emit: (event: eventWithTime) => {
        this.handleEvent(event);
      },
    }) as (() => void) | undefined;

    this.stopRecording = stopHandler ?? null;

    this.isRecording = true;
    this.log("Recording started");
  }

  private handleEvent(event: eventWithTime): void {
    const enrichedEvent = {
      ...event,
      sessionId: this.config.sessionId,
      userId: this.config.userId,
    };

    this.eventQueue.push(enrichedEvent);

    // Flush immediately if batch size is reached or if it's a critical event
    if (
      this.eventQueue.length >= this.config.batchSize ||
      this.isCriticalEvent(event)
    ) {
      this.flushEventQueue();
    } else {
      // Schedule flush if not already scheduled
      this.scheduleFlush();
    }
  }

  private isCriticalEvent(event: eventWithTime): boolean {
    // Immediately send critical events like full snapshots, errors, or custom events
    return event.type === 2 || event.type === 5; // Full snapshot or custom event
  }

  private scheduleFlush(): void {
    if (this.flushTimeout) return;

    this.flushTimeout = setTimeout(() => {
      this.flushEventQueue();
      this.flushTimeout = null;
    }, this.config.flushInterval);
  }

  private flushEventQueue(): void {
    if (
      this.eventQueue.length === 0 ||
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    const events = this.eventQueue.splice(0, this.config.batchSize);

    this.sendMessage({
      type: "events_batch",
      data: {
        sessionId: this.config.sessionId,
        userId: this.config.userId,
        events,
        timestamp: Date.now(),
      },
    });

    // Clear flush timeout if all events are sent
    if (this.eventQueue.length === 0 && this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
  }

  private sendSessionMetadata(): void {
    const metadata: SessionMetadata = {
      sessionId: this.config.sessionId,
      userId: this.config.userId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      referrer: document.referrer,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    this.sendMessage({
      type: "session_start",
      data: metadata,
    });
  }

  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        this.log("Failed to send message:", error);
      }
    }
  }

  private setupLifecycleHandlers(): void {
    // Handle page unload
    const handleUnload = () => {
      this.flushEventQueue();
      this.sendMessage({
        type: "session_end",
        data: {
          sessionId: this.config.sessionId,
          userId: this.config.userId,
          timestamp: Date.now(),
        },
      });
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("unload", handleUnload);

    // Handle page visibility changes
    document.addEventListener("visibilitychange", () => {
      this.sendMessage({
        type: "visibility_change",
        data: {
          sessionId: this.config.sessionId,
          hidden: document.hidden,
          timestamp: Date.now(),
        },
      });
    });

    // Handle errors
    window.addEventListener("error", (event) => {
      this.sendMessage({
        type: "javascript_error",
        data: {
          sessionId: this.config.sessionId,
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
          timestamp: Date.now(),
        },
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      this.sendMessage({
        type: "promise_rejection",
        data: {
          sessionId: this.config.sessionId,
          reason: event.reason?.toString() || "Unknown error",
          timestamp: Date.now(),
        },
      });
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({
          type: "heartbeat",
          data: {
            sessionId: this.config.sessionId,
            timestamp: Date.now(),
          },
        });
      }
    }, 30000); // 30 seconds
  }

  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log("[SessionTracker]", ...args);
    }
  }

  public stop(): void {
    this.isRecording = false;

    if (this.stopRecording) {
      this.stopRecording();
      this.stopRecording = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    this.flushEventQueue();

    if (this.ws) {
      this.ws.close(1000, "Session stopped");
      this.ws = null;
    }

    this.log("Session tracker stopped");
  }

  public getSessionId(): string {
    return this.config.sessionId;
  }

  public getUserId(): string {
    return this.config.userId;
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public getQueueSize(): number {
    return this.eventQueue.length;
  }
}

// Global export
(window as any).SessionTracker = new SessionTracker({
  wsUrl: "ws://localhost:8080/ws",
  userId: "user-123",
  sessionId: "session-123",
  debug: true,
});

export default SessionTracker;
