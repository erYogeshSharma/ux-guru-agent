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
      batchSize: 50,
      flushInterval: 3000,
      recordOptions: {},
      ...config,
    };

    this.init();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initUserId(): string {
    // Create a more stable user ID that persists across sessions but is unique per browser
    let userId = localStorage.getItem("tracker_user_id");
    if (!userId) {
      // Create a unique user ID that includes some browser fingerprinting for uniqueness
      const browserFingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width,
        screen.height,
        new Date().getTimezoneOffset(),
      ].join("|");

      // Create a hash-like identifier from the fingerprint
      const hash = btoa(browserFingerprint).slice(0, 8);
      userId = `user_${Date.now()}_${hash}_${Math.random()
        .toString(36)
        .substr(2, 6)}`;
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

      this.ws.onmessage = (ev: MessageEvent) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg && msg.type === "session_assigned" && msg.data?.sessionId) {
            // Update local session id to the assigned one and resend metadata
            this.config.sessionId = msg.data.sessionId;
            this.log("Session assigned by server:", this.config.sessionId);
            // Resend metadata so server has correct session info under new id
            this.sendSessionMetadata();
          }
        } catch (err) {
          this.log("Failed to parse server message:", err);
        }
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

// Generate unique session and user IDs for each page load
const unique_session_id = crypto.randomUUID();
const unique_user_id = "Yogesh Sharma";

// Always create a new session tracker instance for each page load
// This ensures each browser tab/window gets its own session
const createNewTracker = () => {
  const tracker = new SessionTracker({
    wsUrl: "ws://localhost:8080/ws",
    userId: unique_user_id,
    sessionId: unique_session_id,
    debug: true,
  });

  // Store on window for debugging/inspection
  (window as any).SessionTracker = tracker;

  // Also store session info for debugging
  (window as any).sessionInfo = {
    sessionId: unique_session_id,
    userId: unique_user_id,
    startTime: Date.now(),
  };

  console.log(
    `[SessionTracker] New session created: ${unique_session_id} for user: ${unique_user_id}`
  );
  return tracker;
};

// Check if there's already an active tracker for this specific session
const existingTracker = (window as any).SessionTracker;
if (
  existingTracker &&
  existingTracker.getSessionId() === unique_session_id &&
  existingTracker.isConnected()
) {
  console.debug(
    "[SessionTracker] Active tracker found for this session, reusing..."
  );
} else {
  // Stop existing tracker if it exists
  if (existingTracker && typeof existingTracker.stop === "function") {
    console.debug("[SessionTracker] Stopping previous tracker...");
    existingTracker.stop();
  }

  // Create new tracker
  createNewTracker();
}

export default SessionTracker;
