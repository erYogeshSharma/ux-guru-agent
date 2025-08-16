import FastifyServer from "./services/FastifyServer.js";
import { logger } from "./utils/logger.js";

// Create server instance
const server = new FastifyServer();

// Handle graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`\n🛑 Received ${signal}, shutting down gracefully...`);
  try {
    await server.shutdown();
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  shutdown("unhandledRejection");
});

// Start the server
async function startServer() {
  try {
    await server.start();
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

export default server;
