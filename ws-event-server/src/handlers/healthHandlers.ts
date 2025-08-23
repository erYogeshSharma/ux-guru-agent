import { FastifyRequest, FastifyReply } from "fastify";

export class HealthHandlers {
  static async health(request: FastifyRequest, reply: FastifyReply) {
    const dbStats = await request.server.statsService.getDatabaseStats();
    const sessionStats = request.server.sessionService.getStats();
    const wsStats = request.server.wsService.getStats();

    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: Date.now() - (request.server as any).startTime,
      database: dbStats,
      sessions: sessionStats,
      websockets: wsStats,
    };
  }
}
