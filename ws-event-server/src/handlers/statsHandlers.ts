import { FastifyRequest, FastifyReply } from "fastify";

export interface ServerStats {
  totalClients: number;
  activeSessions: number;
  viewers: number;
  trackers: number;
  totalEvents: number;
  uptime: number;
}

export class StatsHandlers {
  static async getStats(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<ServerStats> {
    const dbStats = await request.server.statsService.getDatabaseStats();
    const sessionStats = request.server.sessionService.getStats();
    const wsStats = request.server.wsService.getStats();

    return {
      totalClients: wsStats.totalClients,
      activeSessions: sessionStats.activeSessions,
      viewers: wsStats.viewers,
      trackers: wsStats.trackers,
      totalEvents: sessionStats.totalEvents + dbStats.totalEvents,
      uptime: Date.now() - (request.server as any).startTime,
    };
  }
}
