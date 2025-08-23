import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import AppDataSource from "@/config/data-source";
import { SessionService } from "@/services/SessionService";
import { AuthService } from "@/services/AuthService";
import { StatsService } from "@/services/StatsService";
import { logger } from "@/utils/logger";

declare module "fastify" {
  interface FastifyInstance {
    sessionService: SessionService;
    authService: AuthService;
    statsService: StatsService;
  }
}

const databasePluginFn: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Initialize TypeORM connection
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    logger.info("📊 TypeORM Database connection established successfully");
  }

  const sessionService = new SessionService();
  const authService = new AuthService();
  const statsService = new StatsService();

  fastify.decorate("sessionService", sessionService);
  fastify.decorate("authService", authService);
  fastify.decorate("statsService", statsService);

  fastify.addHook("onClose", async () => {
    sessionService.cleanup();
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.info("🗄️ Database connection closed");
    }
  });
};

export const databasePlugin = fp(databasePluginFn);
