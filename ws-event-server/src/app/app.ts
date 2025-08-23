import "reflect-metadata";
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { config } from "@/config";
import { logger } from "@/utils/logger";

// Plugins
import { databasePlugin } from "@/plugins/database";
import { swaggerPlugin } from "@/plugins/swagger";
import { authPlugin } from "@/plugins/auth";
import { websocketPlugin } from "@/plugins/websocket";

// Routes
import { healthRoutes } from "@/routes/healthRoutes";
import { authRoutes } from "@/routes/authRoutes";
import { sessionRoutes } from "@/routes/sessionRoutes";
import { statsRoutes } from "@/routes/statsRoutes";
import { rootRoutes } from "@/routes/rootRoutes";

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
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

  // Register CORS for all origins
  await app.register(cors, { origin: true });

  // Register WebSocket support
  await app.register(websocket);

  // Register plugins in dependency order
  await app.register(databasePlugin);
  await app.register(authPlugin);
  await app.register(swaggerPlugin);
  await app.register(websocketPlugin);

  // Register routes
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(sessionRoutes, { prefix: "/sessions" });
  await app.register(statsRoutes);
  await app.register(rootRoutes);

  return app;
}
