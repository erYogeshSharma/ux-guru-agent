import Fastify, { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import { parse } from "url";
import { config } from "../config";
import { logger } from "../utils/logger";
import DatabaseService from "../database";
import SessionService from "../services/SessionService";
import WebSocketService from "../services/WebSocketService";
import { ServerStats } from "../types";

export class FastifyServer {
  private app: FastifyInstance;
  private dbService!: DatabaseService;
  private sessionService!: SessionService;
  private wsService!: WebSocketService;
  private startTime: number;
  private statsInterval?: NodeJS.Timeout;

  constructor() {
    this.startTime = Date.now();
    this.app = Fastify({
      logger: {
        level: config.logger.level,
        transport: {
          target: "pino-pretty",
          options: {
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        },
      },
    });

    // Register CORS for all origins (reflect request origin)
    this.app.register(cors, { origin: true });

    // Register CORS early so routes and websockets inherit the policy.
    // Allowed origins can be provided via ALLOWED_ORIGINS (comma-separated).
    const allowedOriginsEnv = "http://localhost:5173";
    const allowedOrigins = allowedOriginsEnv.split(",").map((s) => s.trim());

    this.initializeServices();
    this.setupRoutes();
    this.setupWebSocket();
    this.startStatsLogging();
  }

  private initializeServices(): void {
    this.dbService = new DatabaseService();
    this.sessionService = new SessionService(this.dbService);
    this.wsService = new WebSocketService(this.sessionService);
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get("/health", async (request, reply) => {
      const dbStats = await this.dbService.getStats();
      const sessionStats = this.sessionService.getStats();
      const wsStats = this.wsService.getStats();

      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        database: dbStats,
        sessions: sessionStats,
        websockets: wsStats,
      };
    });

    // Get server statistics
    this.app.get("/stats", async (request, reply) => {
      const stats = await this.getStats();
      return stats;
    });

    // Get active sessions (REST endpoint)
    this.app.get("/sessions/active", async (request, reply) => {
      try {
        const activeSessions = await this.dbService.getActiveSessions();
        return { sessions: activeSessions };
      } catch (error) {
        reply.status(500);
        return { error: "Failed to fetch active sessions" };
      }
    });

    // Get all sessions with pagination (REST endpoint)
    this.app.get("/sessions", async (request, reply) => {
      try {
        const { limit = 100, offset = 0 } = request.query as {
          limit?: number;
          offset?: number;
        };

        const allSessions = await this.dbService.getAllSessions(limit, offset);
        return { sessions: allSessions, limit, offset };
      } catch (error) {
        reply.status(500);
        return { error: "Failed to fetch session history" };
      }
    });

    // Get session events (REST endpoint)
    this.app.get("/sessions/:sessionId/events", async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        const { fromIndex = 0, limit = 1000 } = request.query as {
          fromIndex?: number;
          limit?: number;
        };

        const events = await this.dbService.getSessionEvents(
          sessionId,
          fromIndex,
          limit
        );

        return {
          sessionId,
          events,
          fromIndex,
          count: events.length,
        };
      } catch (error) {
        reply.status(500);
        return { error: "Failed to fetch session events" };
      }
    });

    // Cleanup old sessions endpoint (for manual cleanup)
    this.app.delete("/sessions/cleanup", async (request, reply) => {
      try {
        const { maxAgeHours = 24 } = request.query as { maxAgeHours?: number };
        const deletedCount = await this.dbService.cleanupOldSessions(
          maxAgeHours
        );

        return {
          message: `Cleaned up ${deletedCount} old sessions`,
          deletedCount,
        };
      } catch (error) {
        reply.status(500);
        return { error: "Failed to cleanup sessions" };
      }
    });

    // Root endpoint with info
    this.app.get("/", async (request, reply) => {
      return {
        name: "Session Replay Server",
        version: "2.0.0",
        endpoints: {
          websocket: "/ws",
          health: "/health",
          stats: "/stats",
          activeSessions: "/sessions/active",
          sessionEvents: "/sessions/:sessionId/events",
          cleanup: "/sessions/cleanup",
        },
        documentation: "WebSocket endpoint supports viewer and tracker clients",
      };
    });
  }

  private setupWebSocket(): void {
    this.app.register(websocket);

    this.app.register(async (fastify) => {
      fastify.get("/ws", { websocket: true }, (connection, req) => {
        const { query } = parse(req.url || "", true);
        const clientType = (query.type as "viewer" | "tracker") || "tracker";
        const clientIp =
          req.headers["x-forwarded-for"] ||
          req.socket.remoteAddress ||
          "unknown";

        // Handle the WebSocket connection through our service
        this.wsService.handleConnection(
          connection,
          clientType,
          clientIp as string
        );
      });
    });
  }

  private startStatsLogging(): void {
    this.statsInterval = setInterval(async () => {
      try {
        const stats = await this.getStats();
        logger.info("📊 Server Stats:", stats);
      } catch (error) {
        logger.error("Failed to get stats:", error);
      }
    }, 60000); // Log stats every minute
  }

  public async getStats(): Promise<ServerStats> {
    const now = Date.now();
    const dbStats = await this.dbService.getStats();
    const sessionStats = this.sessionService.getStats();
    const wsStats = this.wsService.getStats();

    return {
      totalClients: wsStats.totalClients,
      activeSessions: sessionStats.activeSessions,
      viewers: wsStats.viewers,
      trackers: wsStats.trackers,
      totalEvents: sessionStats.totalEvents + dbStats.totalEvents,
      uptime: now - this.startTime,
    };
  }

  public async start(): Promise<void> {
    try {
      await this.app.listen({
        port: config.port,
        host: config.host,
      });

      logger.info(
        `🚀 Session Replay Server running on http://${config.host}:${config.port}`
      );
      logger.info(
        `📊 WebSocket endpoint: ws://${config.host}:${config.port}/ws`
      );
      logger.info(
        `🏥 Health check: http://${config.host}:${config.port}/health`
      );
      logger.info(
        `📈 Stats endpoint: http://${config.host}:${config.port}/stats`
      );
    } catch (error) {
      logger.error("Failed to start server:", error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    logger.info("🛑 Shutting down server...");

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    // Shutdown services in order
    this.wsService.shutdown();
    this.sessionService.shutdown();
    await this.dbService.shutdown();

    // Close Fastify server
    await this.app.close();
    logger.info("✅ Server shutdown complete");
  }
}

export default FastifyServer;
