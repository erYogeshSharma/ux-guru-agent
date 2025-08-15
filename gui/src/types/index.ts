import type { eventWithTime } from "@rrweb/types";

export interface Session {
  sessionId: string;
  userId: string;
  metadata: {
    url: string;
    userAgent: string;
    viewport: { width: number; height: number; devicePixelRatio: number };
    startTime: number;
    lastActivity: number;
    referrer: string;
    timeZone: string;
  };
  eventCount: number;
  errorCount: number;
}

export interface SessionReplayViewerProps {
  wsUrl: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

export interface SessionListProps {
  sessions: Session[];
  selectedSessionId: string | null;
  searchQuery: string;
  filterActive: boolean;
  onSessionSelect: (sessionId: string) => void;
  onSearchChange: (query: string) => void;
  onFilterChange: (active: boolean) => void;
  formatTime: (timestamp: number) => string;
  formatDuration: (startTime: number, lastActivity: number) => string;
}

export interface WelcomeScreenProps {
  className?: string;
}

export type { eventWithTime };
