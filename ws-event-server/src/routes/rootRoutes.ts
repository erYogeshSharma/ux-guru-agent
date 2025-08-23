import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { RootController } from "@/controllers/rootController";

export const rootRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  fastify.get("/", RootController.root);
};
