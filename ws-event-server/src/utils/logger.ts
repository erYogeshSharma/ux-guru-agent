import * as winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { config } from "@/config";

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Console transport with colors
const consoleTransport = new winston.transports.Console({
  format: combine(
    colorize(),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    logFormat
  ),
});

// Daily rotate file transport
const fileTransport = new DailyRotateFile({
  filename: config.logger.filename,
  datePattern: config.logger.datePattern,
  zippedArchive: config.logger.zippedArchive,
  maxSize: config.logger.maxSize,
  maxFiles: config.logger.maxFiles,
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    logFormat
  ),
});

// Error file transport for error-level logs
const errorFileTransport = new DailyRotateFile({
  filename: config.logger.filename.replace("%DATE%", "error-%DATE%"),
  datePattern: config.logger.datePattern,
  zippedArchive: config.logger.zippedArchive,
  maxSize: config.logger.maxSize,
  maxFiles: config.logger.maxFiles,
  level: "error",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    logFormat
  ),
});

// Create logger instance
export const logger = winston.createLogger({
  level: config.logger.level,
  transports: [consoleTransport, fileTransport, errorFileTransport],
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new DailyRotateFile({
      filename: config.logger.filename.replace("%DATE%", "exceptions-%DATE%"),
      datePattern: config.logger.datePattern,
      zippedArchive: config.logger.zippedArchive,
      maxSize: config.logger.maxSize,
      maxFiles: config.logger.maxFiles,
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: config.logger.filename.replace("%DATE%", "rejections-%DATE%"),
      datePattern: config.logger.datePattern,
      zippedArchive: config.logger.zippedArchive,
      maxSize: config.logger.maxSize,
      maxFiles: config.logger.maxFiles,
    }),
  ],
});

// Create session-specific logger methods
export const sessionLogger = {
  sessionStarted: (sessionId: string, userId: string) => {
    logger.info(`🎬 Session started: ${sessionId} for user: ${userId}`);
  },

  sessionEnded: (sessionId: string) => {
    logger.info(`🏁 Session ended: ${sessionId}`);
  },

  sessionError: (sessionId: string, error: any) => {
    logger.error(`💥 Session error in ${sessionId}:`, error);
  },

  batchSaved: (sessionId: string, eventCount: number) => {
    logger.debug(
      `📦 Saved batch for session ${sessionId}: ${eventCount} events`
    );
  },

  sessionTrimmed: (
    sessionId: string,
    originalCount: number,
    newCount: number
  ) => {
    logger.warn(
      `📦 Trimmed events for session ${sessionId} from ${originalCount} to ${newCount}`
    );
  },
};

// Create connection-specific logger methods
export const connectionLogger = {
  clientConnected: (type: string, ip: string, totalClients: number) => {
    logger.info(
      `✅ New ${type} connected from ${ip}. Total clients: ${totalClients}`
    );
  },

  clientDisconnected: (type: string, code: number, reason: string) => {
    logger.info(`👋 ${type} disconnected (${code}: ${reason})`);
  },

  staleClientRemoved: (type: string) => {
    logger.warn(`💀 Removing stale ${type} client`);
  },

  viewerJoinedSession: (sessionId: string) => {
    logger.info(`👀 Viewer joined session: ${sessionId}`);
  },

  viewerLeftSession: (sessionId: string) => {
    logger.info(`👋 Viewer left session: ${sessionId}`);
  },
};

// Database logger methods
export const dbLogger = {
  connected: () => {
    logger.info("🗄️ Database connected successfully");
  },

  connectionError: (error: any) => {
    logger.error("❌ Database connection error:", error);
  },

  queryError: (query: string, error: any) => {
    logger.error(`❌ Database query error for "${query}":`, error);
  },

  batchInserted: (count: number) => {
    logger.debug(`📝 Inserted ${count} session batches to database`);
  },

  cleanup: (deletedCount: number) => {
    logger.info(`🧹 Cleaned up ${deletedCount} old sessions from database`);
  },
};

export default logger;
