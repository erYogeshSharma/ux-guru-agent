import { BaseApiClient } from "./baseClient";
import { API_ENDPOINTS } from "./endpoints";

export interface ServerStats {
  totalClients: number;
  activeSessions: number;
  viewers: number;
  trackers: number;
  totalEvents: number;
  uptime: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  database: Record<string, unknown>;
  sessions: Record<string, unknown>;
  websockets: Record<string, unknown>;
}

export interface StatsResponse {
  success: boolean;
  stats?: ServerStats;
  message?: string;
}

export class HealthApiClient extends BaseApiClient {
  async getHealth(): Promise<HealthResponse> {
    const response = await this.get<HealthResponse>(API_ENDPOINTS.HEALTH);
    return (
      response.data || {
        status: "unknown",
        timestamp: new Date().toISOString(),
        uptime: 0,
        database: {},
        sessions: {},
        websockets: {},
      }
    );
  }

  async getStats(): Promise<ServerStats> {
    const response = await this.get<ServerStats>(API_ENDPOINTS.STATS);
    return (
      response.data || {
        totalClients: 0,
        activeSessions: 0,
        viewers: 0,
        trackers: 0,
        totalEvents: 0,
        uptime: 0,
      }
    );
  }
}
