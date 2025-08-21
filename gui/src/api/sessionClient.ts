import { BaseApiClient } from "./baseClient";
import { API_ENDPOINTS } from "./endpoints";
import type { Session, eventWithTime } from "@/types";

export interface SessionsResponse {
  success: boolean;
  sessions: Session[];
  total?: number;
  page?: number;
  limit?: number;
  message?: string;
}

export interface SessionEventsResponse {
  success: boolean;
  events: eventWithTime[];
  sessionId: string;
  message?: string;
}

export interface CleanupResponse {
  success: boolean;
  deletedCount: number;
  message?: string;
}

export interface SessionQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export class SessionApiClient extends BaseApiClient {
  async getActiveSessions(): Promise<SessionsResponse> {
    const response = await this.get<SessionsResponse>(
      API_ENDPOINTS.SESSIONS.ACTIVE
    );
    return response.data || { success: false, sessions: [] };
  }

  async getAllSessions(params?: SessionQueryParams): Promise<SessionsResponse> {
    const response = await this.get<SessionsResponse>(
      API_ENDPOINTS.SESSIONS.ALL,
      { params: params as Record<string, string | number> }
    );
    return response.data || { success: false, sessions: [] };
  }

  async getSessionEvents(sessionId: string): Promise<SessionEventsResponse> {
    const response = await this.get<SessionEventsResponse>(
      API_ENDPOINTS.SESSIONS.EVENTS(sessionId)
    );
    return response.data || { success: false, events: [], sessionId };
  }

  async cleanupOldSessions(): Promise<CleanupResponse> {
    const response = await this.delete<CleanupResponse>(
      API_ENDPOINTS.SESSIONS.CLEANUP
    );
    return response.data || { success: false, deletedCount: 0 };
  }
}
