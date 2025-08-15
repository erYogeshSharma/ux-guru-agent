import { ServerConfig } from "../types";

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || "8080"),
  host: process.env.HOST || "0.0.0.0",

  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME || "session_replay",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    max: parseInt(process.env.DB_MAX_CONNECTIONS || "20"),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000"),
    connectionTimeoutMillis: parseInt(
      process.env.DB_CONNECTION_TIMEOUT || "2000"
    ),
  },

  logger: {
    level: process.env.LOG_LEVEL || "info",
    filename: process.env.LOG_FILENAME || "logs/application-%DATE%.log",
    datePattern: process.env.LOG_DATE_PATTERN || "YYYY-MM-DD",
    zippedArchive: process.env.LOG_ZIPPED === "true",
    maxSize: process.env.LOG_MAX_SIZE || "20m",
    maxFiles: process.env.LOG_MAX_FILES || "14d",
  },

  batchSize: parseInt(process.env.BATCH_SIZE || "50"),
  batchInterval: parseInt(process.env.BATCH_INTERVAL || "5000"), // 5 seconds
  maxEventsPerSession: parseInt(process.env.MAX_EVENTS_PER_SESSION || "20000"),
  sessionCleanupInterval: parseInt(
    process.env.SESSION_CLEANUP_INTERVAL || "300000"
  ), // 5 minutes
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || "30000"), // 30 seconds
};
