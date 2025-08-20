import "reflect-metadata";
import Fastify, { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import { parse } from "url";
import { config } from "@/config";
import { logger } from "@/utils/logger";
import { TypeORMDatabaseService } from "@/database/TypeORMDatabaseService";
import { TypeORMSessionService } from "@/services/TypeORMSessionService";
import { TypeORMWebSocketService } from "@/services/TypeORMWebSocketService";
import {
  TypeORMAuthService,
  SignupRequest,
  LoginRequest,
  CreateUserRequest,
} from "@/services/TypeORMAuthService";
import {
  TypeORMAuthMiddleware,
  AuthenticatedRequest,
} from "@/middleware/TypeORMAuthMiddleware";
import { UserRole } from "@/entities";

export interface ServerStats {
  totalClients: number;
  activeSessions: number;
  viewers: number;
  trackers: number;
  totalEvents: number;
  uptime: number;
}

export class TypeORMFastifyServer {
  private app: FastifyInstance;
  private dbService!: TypeORMDatabaseService;
  private sessionService!: TypeORMSessionService;
  private wsService!: TypeORMWebSocketService;
  private authService!: TypeORMAuthService;
  private authMiddleware!: TypeORMAuthMiddleware;
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
  }

  async initialize(): Promise<void> {
    await this.initializeServices();
    this.setupRoutes();
    this.setupWebSocket();
    this.startStatsLogging();
  }

  private async initializeServices(): Promise<void> {
    this.dbService = new TypeORMDatabaseService();
    await this.dbService.initialize();

    this.sessionService = new TypeORMSessionService(this.dbService);
    this.wsService = new TypeORMWebSocketService(this.sessionService);
    this.authService = new TypeORMAuthService(this.dbService);
    this.authMiddleware = new TypeORMAuthMiddleware(this.authService);
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
        const signupRequest = request.body as SignupRequest;

        // Validate required fields
        if (
          !signupRequest.name ||
          !signupRequest.email ||
          !signupRequest.companyName ||
          !signupRequest.password
        ) {
          return reply.status(400).send({
            success: false,
            message:
              "All fields are required: name, email, companyName, password",
          });
        }

        const result = await this.authService.signup(signupRequest);

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

    // Protected route to get user info
    this.app.get(
      "/auth/me",
      {
        preHandler: this.authMiddleware.authenticate,
      },
      async (request: AuthenticatedRequest, reply) => {
        return {
          success: true,
          user: {
            id: request.user!.id,
            name: request.user!.name,
            email: request.user!.email,
            role: request.user!.role,
            organization: {
              id: request.user!.organization.id,
              name: request.user!.organization.name,
              companyName: request.user!.organization.companyName,
              email: request.user!.organization.email,
            },
          },
        };
      }
    );

    // Create new user (admin/manager only)
    this.app.post(
      "/auth/users",
      {
        preHandler: this.authMiddleware.requireManager,
      },
      async (request: AuthenticatedRequest, reply) => {
        try {
          const createUserRequest = request.body as CreateUserRequest;

          // Force organization ID to be the authenticated user's organization
          createUserRequest.organizationId = request.organizationId!;

          const result = await this.authService.createUser(
            createUserRequest,
            request.userId!
          );

          if (result.success) {
            return reply.status(201).send(result);
          } else {
            return reply.status(400).send(result);
          }
        } catch (error) {
          logger.error("Create user error:", error);
          return reply.status(500).send({
            success: false,
            message: "Internal server error",
          });
        }
      }
    );

    // Get organization users (admin/manager only)
    this.app.get(
      "/auth/users",
      {
        preHandler: this.authMiddleware.requireManager,
      },
      async (request: AuthenticatedRequest, reply) => {
        try {
          const users = await this.authService.getOrganizationUsers(
            request.organizationId!
          );

          // Remove password hashes from response
          const safeUsers = users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
          }));

          return { users: safeUsers };
        } catch (error) {
          logger.error("Get users error:", error);
          return reply.status(500).send({
            error: "Failed to fetch users",
          });
        }
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
          const activeSessions =
            await this.dbService.getActiveSessionsByOrganization(
              request.organizationId!
            );
          return { sessions: activeSessions };
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

          const allSessions = await this.dbService.getSessionsByOrganization(
            request.organizationId!,
            limit,
            offset
          );

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

          // Verify session belongs to the organization
          const session = await this.dbService.getSessionById(sessionId);
          if (!session || session.organizationId !== request.organizationId) {
            return reply.status(404).send({ error: "Session not found" });
          }

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

    // Cleanup old sessions endpoint (admin only)
    this.app.delete(
      "/sessions/cleanup",
      {
        preHandler: this.authMiddleware.requireAdmin,
      },
      async (request, reply) => {
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
      }
    );

    // Root endpoint with info
    this.app.get("/", async (request, reply) => {
      return {
        name: "Session Replay Server with TypeORM",
        version: "3.0.0",
        features: [
          "Multi-tenant",
          "Role-based access",
          "TypeORM",
          "PostgreSQL",
        ],
        endpoints: {
          websocket: "/ws",
          health: "/health",
          stats: "/stats",
          auth: {
            signup: "POST /auth/signup",
            signin: "POST /auth/signin",
            me: "GET /auth/me",
            users: {
              create: "POST /auth/users",
              list: "GET /auth/users",
            },
          },
          sessions: {
            active: "GET /sessions/active",
            all: "GET /sessions",
            events: "GET /sessions/:sessionId/events",
            cleanup: "DELETE /sessions/cleanup (admin only)",
          },
        },
        documentation:
          "Multi-tenant session replay server with role-based authentication. All session endpoints require authentication.",
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
        `🚀 Session Replay Server with TypeORM running on http://${config.host}:${config.port}`
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
      logger.info(`🔐 Multi-tenant authentication enabled`);
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

export default TypeORMFastifyServer;
