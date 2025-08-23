import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { HealthController } from "@/controllers/healthController";
import { healthSchema } from "@/schemas/healthSchema";

export const healthRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  fastify.get("/health", { schema: healthSchema }, HealthController.health);
};
