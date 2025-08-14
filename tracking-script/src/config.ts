/**
 * Global runtime configuration & constants for the tracking script.
 * Keeping everything central makes it easy to tweak behaviour without
 * hunting through multiple files and also enforces consistent usage
 * (e.g. event type strings).
 */
export const CONFIG = {
  // --- Networking / Connection ---
  WS_URL: "ws://localhost:8080", // WebSocket endpoint for ingest
  RECONNECT_DELAY: 2000, // ms between reconnection attempts

  // --- Storage Keys ---
  VISITOR_STORAGE_KEY: "ux_guru_visitor_id", // persistent (localStorage)
  SESSION_STORAGE_KEY: "ux_guru_session_id", // per-tab / per-session (sessionStorage)

  // --- Event Throttling / Debouncing ---
  MOUSE_MOVE_INTERVAL: 100, // throttle mouse move events (ms)
  SNAPSHOT_IDLE_DELAY: 1000, // wait this long (ms) after last request before taking a snapshot

  // --- Snapshot Quality Constraints ---
  MAX_DPR_MULTIPLIER: 2, // cap devicePixelRatio to avoid huge canvases
  MAX_SNAPSHOT_PIXELS: 1200000, // approx 1.2MP hard ceiling (width * height * scale^2)

  // --- Event Type Canonical Strings ---
  EVENT_TYPES: {
    SESSION_START: "sessionStart",
    HANDSHAKE: "handshake",
    CURSOR_MOVE: "cursorMove",
    CLICK: "click",
    WINDOW_DIMENSION: "windowDimension",
    SCROLL: "scroll",
    SNAPSHOT: "snapshot",
  } as const,
} as const;

// Convenience Type for Event Type values
export type EventType =
  (typeof CONFIG.EVENT_TYPES)[keyof typeof CONFIG.EVENT_TYPES];
