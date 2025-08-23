import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { StatsController } from "@/controllers/statsController";

export const statsRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  fastify.get("/stats", StatsController.getStats);
};
