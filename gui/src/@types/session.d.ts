//START: "/sessions" Types Start
export interface SessionResponse {
  sessions: Session[];
  limit: number;
  offset: number;
}

export interface Session {
  id: string;
  userId: string;
  metadata: SessionMetadata;
  isActive: boolean;
  eventCount: number;
  errorCount: number;
  endedAt: string; // ISO datetime string
  createdAt: string; // ISO datetime string
  updatedAt: string; // ISO datetime string
  organizationId: string;
}

export interface SessionMetadata {
  url: string;
  referrer: string;
  timeZone: string;
  viewport: Viewport;
  userAgent: string;
}

export interface Viewport {
  width: number;
  height: number;
  devicePixelRatio: number;
}
// END: "/sessions" Types
