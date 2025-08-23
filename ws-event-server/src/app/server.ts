import "reflect-metadata";
import { createApp } from "./app";
import { config } from "@/config";
import { logger } from "@/utils/logger";

export class Server {
  private app: any;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  async initialize(): Promise<void> {
    this.app = await createApp();
    // Store startTime in the app for handlers to access
    this.app.decorate("startTime", this.startTime);
  }

  async start(): Promise<void> {
    try {
      await this.app.listen({
        port: config.port,
        host: config.host,
      });

      logger.info(
        `🚀 Session Replay Server running on http://${config.host}:${config.port}`
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

  async shutdown(): Promise<void> {
    logger.info("🛑 Shutting down server...");

    if (this.app) {
      await this.app.close();
    }

    logger.info("✅ Server shutdown complete");
  }

  get fastifyApp() {
    return this.app;
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }
}
