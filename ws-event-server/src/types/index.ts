import { WebSocket } from "ws";

export interface ConnectedClient {
  ws: WebSocket;
  type: "viewer" | "tracker";
  sessionId?: string;
  userId?: string;
  joinedAt: number;
  lastHeartbeat: number;
  watchingSessions: Set<string>;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  events: any[];
  metadata: {
    url: string;
    userAgent: string;
    viewport: { width: number; height: number; devicePixelRatio: number };
    startTime: number;
    lastActivity: number;
    referrer: string;
    timeZone: string;
  };
  isActive: boolean;
  errors: any[];
}

export interface ServerStats {
  totalClients: number;
  activeSessions: number;
  viewers: number;
  trackers: number;
  totalEvents: number;
  uptime: number;
}

export interface SessionBatch {
  sessionId: string;
  userId: string;
  events: any[];
  metadata: any;
  isActive: boolean;
  errors: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export interface LoggerConfig {
  level: string;
  filename: string;
  datePattern: string;
  zippedArchive: boolean;
  maxSize: string;
  maxFiles: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  database: DatabaseConfig;
  logger: LoggerConfig;
  batchSize: number;
  batchInterval: number;
  maxEventsPerSession: number;
  sessionCleanupInterval: number;
  heartbeatInterval: number;
}
