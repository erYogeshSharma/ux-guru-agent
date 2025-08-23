import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { AuthHandlers } from "@/handlers/authHandlers";
import { authSchemas } from "@/schemas/authSchemas";

export const authRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Authentication routes
  fastify.post("/signup", { schema: authSchemas.signup }, AuthHandlers.signup);
  fastify.post("/signin", { schema: authSchemas.signin }, AuthHandlers.signin);
  fastify.post(
    "/forgot-password",
    { schema: authSchemas.forgotPassword },
    AuthHandlers.forgotPassword
  );
  fastify.post(
    "/reset-password",
    { schema: authSchemas.resetPassword },
    AuthHandlers.resetPassword
  );
  fastify.post(
    "/refresh",
    { schema: authSchemas.refresh },
    AuthHandlers.refresh
  );

  // Protected routes
  fastify.get(
    "/me",
    {
      preHandler: fastify.authMiddleware.authenticate,
    },
    AuthHandlers.me
  );

  // Admin/Manager routes
  fastify.post(
    "/users",
    {
      preHandler: fastify.authMiddleware.requireManager,
    },
    AuthHandlers.createUser
  );

  fastify.get(
    "/users",
    {
      preHandler: fastify.authMiddleware.requireManager,
    },
    AuthHandlers.getUsers
  );
};
