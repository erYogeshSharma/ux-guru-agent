// UX Guru Website Tracking Script
// This script tracks user behavior on websites for UX analysis
//
// CONFIGURATION REQUIRED:
// 1. Set ORGANIZATION_ID to your unique organization identifier
// 2. Update wsUrl to point to your UX Guru server
// 3. Embed this script in your website's HTML
//
// The script will:
// - Generate anonymous visitor IDs for website users
// - Track user sessions across page navigation (same tab/window)
// - Send behavioral events to your UX Guru dashboard
// - Preserve privacy by masking sensitive input data

import { record } from "rrweb";
import type { eventWithTime } from "@rrweb/types";
import CustomEventTracker from "./CustomEventTracker";
import { DEFAULT_CONFIG, type TrackingConfig } from "./config";

interface TrackerConfig {
  wsUrl: string;
  organizationId: string; // Required - identifies which organization owns this website
  sessionId?: string;
  userId?: string;
  debug?: boolean;
  recordOptions?: Partial<any>;
  batchSize?: number;
  flushInterval?: number;
  enableCustomEvents?: boolean;
}

interface SessionMetadata {
  sessionId: string;
  userId: string;
  organizationId: string;
  url: string;
  timestamp: number;
  metadata: {
    userAgent: string;
    referrer: string;
    timeZone: string;
    viewport: {
      width: number;
      height: number;
      devicePixelRatio: number;
    };
    url: string;
  };
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
  private customEventTracker: CustomEventTracker | null = null;

  constructor(config: TrackerConfig) {
    this.config = {
      sessionId: this.generateSessionId(),
      userId: this.initUserId(),
      debug: true,
      batchSize: 50,
      flushInterval: 3000,
      recordOptions: {},
      enableCustomEvents: true,
      ...config, // organizationId will be included from config
    };

    this.init();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initUserId(): string {
    // Create a more stable anonymous user ID that persists across sessions
    // This represents an anonymous website visitor, not a known user
    let userId = localStorage.getItem("ux_guru_visitor_id");
    if (!userId) {
      // Create a unique anonymous visitor ID with browser fingerprinting
      const browserFingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width,
        screen.height,
        new Date().getTimezoneOffset(),
        navigator.platform,
      ].join("|");

      // Create a hash-like identifier from the fingerprint
      const hash = btoa(browserFingerprint).slice(0, 12);
      userId = `visitor_${Date.now()}_${hash}_${Math.random()
        .toString(36)
        .substr(2, 8)}`;
      localStorage.setItem("ux_guru_visitor_id", userId);
    }
    return userId;
  }

  private init(): void {
    this.connectWebSocket();
    this.startRecording();
    this.setupLifecycleHandlers();
    this.startHeartbeat();

    // Initialize custom event tracking if enabled
    if (this.config.enableCustomEvents) {
      this.initCustomEventTracker();
    }
  }

  /**
   * Initialize custom event tracker
   */
  private initCustomEventTracker(): void {
    this.customEventTracker = new CustomEventTracker({
      sessionId: this.config.sessionId,
      userId: this.config.userId,
      debug: this.config.debug,
      enableRageClickDetection: true,
      enableScrollDepthTracking: true,
      enableIdleDetection: true,
      enableFormAbandonment: true,
    });

    this.log(
      "Custom event tracker initialized for organization:",
      this.config.organizationId
    );
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
          if (msg && msg.type === "session_started" && msg.data?.sessionId) {
            // Server confirms session started
            this.log("Session confirmed by server:", msg.data.sessionId);
          } else if (msg && msg.type === "events_received") {
            // Server confirms events received
            this.log("Events confirmed by server:", msg.data);
          } else if (msg && msg.type === "error") {
            // Server error
            this.log("Server error:", msg.data?.message);
          } else if (msg && msg.type === "connected") {
            // Welcome message from server
            this.log("Connected to server:", msg.data);
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
      type: "session_events", // Changed from "events_batch" to match WebSocket service
      data: {
        sessionId: this.config.sessionId,
        events,
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
      organizationId: this.config.organizationId,
      url: window.location.href,
      timestamp: Date.now(),
      metadata: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        },
      },
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

    // Stop custom event tracker
    if (this.customEventTracker) {
      this.customEventTracker.destroy();
      this.customEventTracker = null;
    }

    this.flushEventQueue();

    if (this.ws) {
      this.ws.close(1000, "Session stopped");
      this.ws = null;
    }

    this.log("Session tracker stopped");
  }

  /**
   * Track a business event (public method for application use)
   */
  public trackBusinessEvent(
    type:
      | "signup_started"
      | "signup_completed"
      | "checkout_started"
      | "checkout_completed"
      | "add_to_cart"
      | "remove_from_cart"
      | "feature_used"
      | "conversion",
    data: any
  ): void {
    if (this.customEventTracker) {
      this.customEventTracker.trackBusinessEvent(type, data);
    } else {
      this.log("Custom event tracker not initialized");
    }
  }

  /**
   * Set user property (public method for application use)
   */
  public setUserProperty(propertyName: string, propertyValue: string): void {
    if (this.customEventTracker) {
      this.customEventTracker.setUserProperty(propertyName, propertyValue);
    } else {
      this.log("Custom event tracker not initialized");
    }
  }

  public getSessionId(): string {
    return this.config.sessionId;
  }

  public getUserId(): string {
    return this.config.userId;
  }

  public getOrganizationId(): string {
    return this.config.organizationId;
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public getQueueSize(): number {
    return this.eventQueue.length;
  }
}

// Generate unique session and user IDs for website visitors
// Session ID persists for a browser session (until tab/window is closed)
// User ID persists longer to identify the same visitor across sessions

let unique_session_id = sessionStorage.getItem("ux_guru_session_id") || "";
if (!unique_session_id) {
  unique_session_id = `session_${Date.now()}_${crypto.randomUUID()}`;
  sessionStorage.setItem("ux_guru_session_id", unique_session_id);
}

// Configuration - organizations can override this by setting window.UX_GURU_CONFIG
const TRACKING_CONFIG: TrackingConfig = {
  ...DEFAULT_CONFIG,
  // Allow override from global config
  ...((window as any).UX_GURU_CONFIG || {}),
};

// Always create a new session tracker instance for each page load
// This ensures proper tracking across page navigation within the same session
const createNewTracker = () => {
  const tracker = new SessionTracker({
    ...TRACKING_CONFIG,
    sessionId: unique_session_id,
  });

  // Store on window for debugging/inspection
  (window as any).SessionTracker = tracker;

  // Also store session info for debugging
  (window as any).sessionInfo = {
    sessionId: unique_session_id,
    userId: tracker.getUserId(),
    organizationId: tracker.getOrganizationId(),
    startTime: Date.now(),
  };

  console.log(
    `[SessionTracker] New session created: ${unique_session_id} for visitor: ${tracker.getUserId()}`
  );

  // Example of tracking business events (can be called from your application)
  // tracker.trackBusinessEvent('feature_used', { featureName: 'session_tracker_initialized' });
  // tracker.setUserProperty('role', 'developer');

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
