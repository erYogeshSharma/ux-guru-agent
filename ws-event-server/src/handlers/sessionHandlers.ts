import { FastifyRequest, FastifyReply } from "fastify";
import { AuthenticatedRequest } from "@/middleware/AuthMiddleware";
import { SessionController } from "@/controllers/sessionController";
import { logger } from "@/utils/logger";

export class SessionHandlers {
  static async getActiveSessions(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const sessionController = new SessionController(
        request.server.sessionService
      );
      const result = await sessionController.getActiveSessions(
        request.organizationId!
      );
      return result;
    } catch (error) {
      logger.error("Get active sessions handler error:", error);
      reply.status(500);
      return { error: "Failed to fetch active sessions" };
    }
  }

  static async getAllSessions(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const { limit = 100, offset = 0 } = request.query as {
        limit?: number;
        offset?: number;
      };

      const sessionController = new SessionController(
        request.server.sessionService
      );
      const result = await sessionController.getAllSessions(
        request.organizationId!,
        limit,
        offset
      );
      return result;
    } catch (error) {
      logger.error("Get all sessions handler error:", error);
      reply.status(500);
      return { error: "Failed to fetch session history" };
    }
  }

  static async getSessionEvents(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const { fromIndex = 0, limit = 1000 } = request.query as {
        fromIndex?: number;
        limit?: number;
      };

      const sessionController = new SessionController(
        request.server.sessionService
      );
      const result = await sessionController.getSessionEvents(
        sessionId,
        request.organizationId!,
        fromIndex,
        limit
      );
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === "Session not found") {
        return reply.status(404).send({ error: "Session not found" });
      }
      logger.error("Get session events handler error:", error);
      reply.status(500);
      return { error: "Failed to fetch session events" };
    }
  }

  static async cleanupSessions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { maxAgeHours } = request.query as { maxAgeHours?: number };
      const age = typeof maxAgeHours === "number" ? maxAgeHours : 24;

      const sessionController = new SessionController(
        request.server.sessionService
      );
      const result = await sessionController.cleanupOldSessions(age);
      return result;
    } catch (error) {
      logger.error("Cleanup sessions handler error:", error);
      reply.status(500);
      return { error: "Failed to cleanup sessions" };
    }
  }
}
