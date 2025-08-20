import Fastify, { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import { parse } from "url";
import { config } from "../config";
import { logger } from "../utils/logger";
import DatabaseService from "../database";
import SessionService from "../services/SessionService";
import WebSocketService from "../services/WebSocketService";
import AuthService from "../services/AuthService";
import AuthMiddleware, {
  AuthenticatedRequest,
} from "../middleware/AuthMiddleware";
import { ServerStats, AuthRequest, LoginRequest } from "../types";

export class FastifyServer {
  private app: FastifyInstance;
  private dbService!: DatabaseService;
  private sessionService!: SessionService;
  private wsService!: WebSocketService;
  private authService!: AuthService;
  private authMiddleware!: AuthMiddleware;
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
    this.authService = new AuthService(this.dbService);
    this.authMiddleware = new AuthMiddleware(this.authService);
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

    // Authentication routes
    this.app.post("/auth/signup", async (request, reply) => {
      try {
        const authRequest = request.body as AuthRequest;

        // Validate required fields
        if (
          !authRequest.name ||
          !authRequest.email ||
          !authRequest.companyName ||
          !authRequest.password
        ) {
          return reply.status(400).send({
            success: false,
            message:
              "All fields are required: name, email, companyName, password",
          });
        }

        const result = await this.authService.signup(authRequest);

        if (result.success) {
          return reply.status(201).send(result);
        } else {
          return reply.status(400).send(result);
        }
      } catch (error) {
        logger.error("Signup error:", error);
        return reply.status(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    });

    this.app.post("/auth/signin", async (request, reply) => {
      try {
        const loginRequest = request.body as LoginRequest;

        // Validate required fields
        if (!loginRequest.email || !loginRequest.password) {
          return reply.status(400).send({
            success: false,
            message: "Email and password are required",
          });
        }

        const result = await this.authService.signin(loginRequest);

        if (result.success) {
          return reply.status(200).send(result);
        } else {
          return reply.status(401).send(result);
        }
      } catch (error) {
        logger.error("Signin error:", error);
        return reply.status(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    });

    // Protected route to get organization info
    this.app.get(
      "/auth/me",
      {
        preHandler: this.authMiddleware.authenticate,
      },
      async (request: AuthenticatedRequest, reply) => {
        return {
          success: true,
          organization: request.organization,
        };
      }
    );

    // Get server statistics
    this.app.get("/stats", async (request, reply) => {
      const stats = await this.getStats();
      return stats;
    });

    // Get active sessions (REST endpoint) - Protected
    this.app.get(
      "/sessions/active",
      {
        preHandler: this.authMiddleware.authenticate,
      },
      async (request: AuthenticatedRequest, reply) => {
        try {
          const activeSessions = await this.dbService.getActiveSessions();
          // Filter sessions by organization if authenticated
          const filteredSessions = request.organizationId
            ? activeSessions.filter(
                (session) => session.organizationId === request.organizationId
              )
            : activeSessions;

          return { sessions: filteredSessions };
        } catch (error) {
          reply.status(500);
          return { error: "Failed to fetch active sessions" };
        }
      }
    );

    // Get all sessions with pagination (REST endpoint) - Protected
    this.app.get(
      "/sessions",
      {
        preHandler: this.authMiddleware.authenticate,
      },
      async (request: AuthenticatedRequest, reply) => {
        try {
          const { limit = 100, offset = 0 } = request.query as {
            limit?: number;
            offset?: number;
          };

          // Get sessions for the authenticated organization
          const allSessions = request.organizationId
            ? await this.dbService.getSessionsByOrganization(
                request.organizationId,
                limit,
                offset
              )
            : await this.dbService.getAllSessions(limit, offset);

          return { sessions: allSessions, limit, offset };
        } catch (error) {
          reply.status(500);
          return { error: "Failed to fetch session history" };
        }
      }
    );

    // Get session events (REST endpoint) - Protected
    this.app.get(
      "/sessions/:sessionId/events",
      {
        preHandler: this.authMiddleware.authenticate,
      },
      async (request: AuthenticatedRequest, reply) => {
        try {
          const { sessionId } = request.params as { sessionId: string };
          const { fromIndex = 0, limit = 1000 } = request.query as {
            fromIndex?: number;
            limit?: number;
          };

          // TODO: Verify that the session belongs to the authenticated organization
          // For now, we'll trust that the organization has access to the session
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
      }
    );

    // Cleanup old sessions endpoint (for manual cleanup)
    this.app.delete("/sessions/cleanup", async (request, reply) => {
      try {
        const { maxAgeHours } = request.query as { maxAgeHours?: number };
        const age =
          typeof maxAgeHours === "number"
            ? maxAgeHours
            : config.sessionRetentionHours || 24;
        const deletedCount = await this.dbService.cleanupOldSessions(age);

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
          auth: {
            signup: "POST /auth/signup",
            signin: "POST /auth/signin",
            me: "GET /auth/me",
          },
          sessions: {
            active: "GET /sessions/active",
            all: "GET /sessions",
            events: "GET /sessions/:sessionId/events",
            cleanup: "DELETE /sessions/cleanup",
          },
        },
        documentation:
          "WebSocket endpoint supports viewer and tracker clients. All session endpoints require authentication.",
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
