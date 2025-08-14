import { detectTenantId, getOrCreateVisitorId } from "./utils";
import { WebSocketManager } from "./websocket";
import { SnapshotManager } from "./snapshot";
import { EventTracker } from "./event-tracker";
import { HandshakePayload, SessionStartPayload } from "./types";
import { CONFIG } from "./config";

/**
 * Generate / reuse a session id (per tab). Using sessionStorage ensures it
 * resets upon full tab close while surviving reloads / navigations, which
 * is desirable for a logical session boundary.
 */
function getOrCreateSessionId(): string {
  try {
    const key = CONFIG.SESSION_STORAGE_KEY;
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id =
      crypto?.randomUUID?.() ||
      `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return (
      crypto?.randomUUID?.() ||
      `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
  }
}

/** Basic UA parsing – intentionally lightweight (avoid big libs). */
function parseUserAgent(ua: string): {
  os: string | null;
  browser: string | null;
  deviceType: string;
} {
  const lower = ua.toLowerCase();
  let os: string | null = null;
  if (lower.includes("win")) os = "Windows";
  else if (lower.includes("mac")) os = "macOS";
  else if (lower.includes("linux")) os = "Linux";
  else if (lower.includes("iphone") || lower.includes("ipad")) os = "iOS";
  else if (lower.includes("android")) os = "Android";

  let browser: string | null = null;
  if (lower.includes("chrome") && !lower.includes("edg")) browser = "Chrome";
  else if (lower.includes("safari") && !lower.includes("chrome"))
    browser = "Safari";
  else if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("edg")) browser = "Edge";

  const isMobile = /mobi|iphone|android/.test(lower);
  const isTablet = /ipad|tablet/.test(lower);
  const deviceType = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  return { os, browser, deviceType };
}

function getZoomApprox(): number {
  try {
    // Approximation technique; will be 1 in many cases. Non-critical metric.
    const ratio = window.devicePixelRatio || 1;
    return Number(ratio.toFixed(2));
  } catch {
    return 1;
  }
}

function buildSessionStartPayload(
  sessionId: string,
  visitorId: string
): SessionStartPayload {
  const ua = navigator.userAgent;
  const { os, browser, deviceType } = parseUserAgent(ua);
  const connection: any =
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;
  return {
    sessionId,
    visitorId,
    url: window.location.href,
    referrer: document.referrer || "",
    title: document.title || "",
    timestamp: Date.now(),
    userAgent: ua,
    os,
    browser,
    deviceType,
    pixelRatio: window.devicePixelRatio || 1,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    zoom: getZoomApprox(),
    network: connection
      ? {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        }
      : undefined,
  };
}

(() => {
  // Initialize core components
  const TENANT_ID = detectTenantId();
  const VISITOR_ID = getOrCreateVisitorId();

  // Create WebSocket manager
  const wsManager = new WebSocketManager(TENANT_ID, VISITOR_ID);

  // Create snapshot manager (handles idle snapshot consolidation)
  const snapshotManager = new SnapshotManager((type, payload) => {
    wsManager.sendEvent(type, payload);
  });

  // Create event tracker
  const eventTracker = new EventTracker(
    (type, payload) => wsManager.sendEvent(type, payload),
    () => snapshotManager.requestSnapshot(),
    () => snapshotManager.shouldScheduleAfterMutation()
  );

  // Initialize the tracking system
  function initialize() {
    // Connect WebSocket
    wsManager.connect();

    // Send handshake + session start once connected
    const checkConnectionAndSendHandshake = () => {
      if (wsManager.isConnected()) {
        const handshakePayload: HandshakePayload = {
          url: window.location.href,
        };
        wsManager.sendEvent(CONFIG.EVENT_TYPES.HANDSHAKE, handshakePayload);

        const sessionId = getOrCreateSessionId();
        const sessionPayload = buildSessionStartPayload(sessionId, VISITOR_ID);
        wsManager.sendEvent(CONFIG.EVENT_TYPES.SESSION_START, sessionPayload);
      } else {
        setTimeout(checkConnectionAndSendHandshake, 100);
      }
    };
    checkConnectionAndSendHandshake();

    // Start event tracking
    eventTracker.startTracking();

    console.log(
      "[Tracker] Initialized successfully (session + handshake sent once WS open)"
    );
  }

  // Start everything
  initialize();
})();
