import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { AuthMiddleware } from "@/middleware/AuthMiddleware";

declare module "fastify" {
  interface FastifyInstance {
    authMiddleware: AuthMiddleware;
  }
}

const authPluginFn: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const authMiddleware = new AuthMiddleware(fastify.authService);

  fastify.decorate("authMiddleware", authMiddleware);
};

export const authPlugin = fp(authPluginFn);
