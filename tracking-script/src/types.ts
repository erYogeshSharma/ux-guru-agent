export interface EventEnvelope<T = any> {
  type: string;
  tenantId: string | null;
  visitorId: string;
  payload: T;
  timestamp: number;
}

export interface CursorMovePayload {
  x: number;
  y: number;
}

export interface ClickPayload {
  x: number;
  y: number;
}

export interface WindowDimensionPayload {
  width: number;
  height: number;
}

export interface HandshakePayload {
  url: string;
}

/**
 * Payload sent once at the beginning of a visitor session (or when device / page context changes).
 * Includes rich context so the backend can index and join subsequent low-level events efficiently.
 */
export interface SessionStartPayload {
  sessionId: string; // logical session identifier (per tab lifecycle)
  visitorId: string; // stable visitor id
  url: string;
  referrer: string;
  title: string;
  timestamp: number; // ms epoch time of session creation
  // Device / Browser
  userAgent: string;
  os: string | null;
  browser: string | null;
  deviceType: string; // mobile / tablet / desktop heuristic
  pixelRatio: number;
  // Viewport
  viewportWidth: number;
  viewportHeight: number;
  zoom: number; // attempt to approximate (layoutViewportWidth * devicePixelRatio) / screenWidth, may be 1
  // Network (best-effort; may be undefined in some browsers)
  network?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
}

export interface SnapshotPayload {
  data: string; // base64
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollX: number;
  scrollY: number;
  mime: string;
  quality: number;
  scale: number;
  // New optimization fields
  type?: "full" | "viewport" | "diff" | "tile";
  tileX?: number;
  tileY?: number;
  tileWidth?: number;
  tileHeight?: number;
  diffRegions?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    data: string;
  }>;
}

export interface ScrollPayload {
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
}
