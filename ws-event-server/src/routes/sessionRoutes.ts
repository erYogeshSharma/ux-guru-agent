import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { SessionHandlers } from "@/handlers/sessionHandlers";

export const sessionRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Protected session routes
  fastify.get(
    "/active",
    {
      preHandler: fastify.authMiddleware.authenticate,
    },
    SessionHandlers.getActiveSessions
  );

  fastify.get(
    "/",
    {
      preHandler: fastify.authMiddleware.authenticate,
    },
    SessionHandlers.getAllSessions
  );

  fastify.get(
    "/:sessionId/events",
    {
      preHandler: fastify.authMiddleware.authenticate,
    },
    SessionHandlers.getSessionEvents
  );

  // Admin only routes
  fastify.delete(
    "/cleanup",
    {
      preHandler: fastify.authMiddleware.requireAdmin,
    },
    SessionHandlers.cleanupSessions
  );
};
