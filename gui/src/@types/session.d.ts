import { eventWithTime } from "@rrweb/types";

export interface PaginatedResponse<T> extends Pagination {
  data: T[];
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

// --- Session-specific types ---

export type SessionResponse = PaginatedResponse<Session>;

export interface Session {
  id: string;
  userId: string;
  metadata: SessionMetadata;
  isActive: boolean;
  eventCount: number;
  errorCount: number;
  endedAt: string; // ISO timestamp
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
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

export type SessionEventBatch = {
  id: number;
  sessionId: string;
  createdAt: string;
  eventCount: number;
  events: eventWithTime[];
};

export type SessionEventsResponse = PaginatedResponse<SessionEventBatch[]>;
