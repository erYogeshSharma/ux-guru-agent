/**
 * API Client for Session Replay Server
 * Handles HTTP requests to the Fastify server endpoints
 */

import type {
  AuthResponse,
  SignupRequest,
  SigninRequest,
  CreateUserRequest,
  User,
} from "@/types/auth";

export interface ApiSession {
  sessionId: string;
  userId: string;
  metadata: {
    url: string;
    userAgent: string;
    startTime: number;
    lastActivity: number;
    viewport?: {
      width: number;
      height: number;
      devicePixelRatio: number;
    };
    referrer?: string;
    timeZone?: string;
  };
  eventCount: number;
  errorCount?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiSessionEvent {
  id: number;
  sessionId: string;
  eventIndex: number;
  eventData: Record<string, unknown>;
  timestamp: number;
}

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

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = "http://localhost:8000") {
    this.baseUrl = baseUrl;
    // Load token from localStorage on initialization
    this.authToken = localStorage.getItem("authToken");
  }

  // Set auth token
  setAuthToken(token: string | null) {
    this.authToken = token;
    if (token) {
      localStorage.setItem("authToken", token);
    } else {
      localStorage.removeItem("authToken");
    }
  }

  // Get auth headers
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          ...this.getAuthHeaders(),
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          this.setAuthToken(null);
          throw new Error("Authentication required");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error;
    }
  }

  // ===== Authentication Methods =====

  async signup(data: SignupRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async signin(data: SigninRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/signin", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getCurrentUser(): Promise<{ success: boolean; user: User }> {
    return this.request<{ success: boolean; user: User }>("/auth/me");
  }

  async getOrganizationUsers(): Promise<{ users: User[] }> {
    return this.request<{ users: User[] }>("/auth/users");
  }

  async createUser(data: CreateUserRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Health check
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health");
  }

  // Server statistics
  async getStats(): Promise<ServerStats> {
    return this.request<ServerStats>("/stats");
  }

  // ===== Session Methods (Protected) =====

  // Get active sessions
  async getActiveSessions(): Promise<{ sessions: ApiSession[] }> {
    return this.request<{ sessions: ApiSession[] }>("/sessions/active");
  }

  // Get session history (all sessions with pagination)
  async getSessionHistory(
    limit: number = 100,
    offset: number = 0
  ): Promise<{ sessions: ApiSession[]; limit: number; offset: number }> {
    return this.request<{
      sessions: ApiSession[];
      limit: number;
      offset: number;
    }>(`/sessions?limit=${limit}&offset=${offset}`);
  }

  // Get session events
  async getSessionEvents(
    sessionId: string,
    fromIndex: number = 0,
    limit: number = 1000
  ): Promise<{
    sessionId: string;
    events: ApiSessionEvent[];
    fromIndex: number;
    count: number;
  }> {
    const params = new URLSearchParams({
      fromIndex: fromIndex.toString(),
      limit: limit.toString(),
    });

    return this.request<{
      sessionId: string;
      events: ApiSessionEvent[];
      fromIndex: number;
      count: number;
    }>(`/sessions/${sessionId}/events?${params}`);
  }

  // Cleanup old sessions
  async cleanupOldSessions(maxAgeHours: number = 24): Promise<{
    message: string;
    deletedCount: number;
  }> {
    const params = new URLSearchParams({
      maxAgeHours: maxAgeHours.toString(),
    });

    return this.request<{
      message: string;
      deletedCount: number;
    }>(`/sessions/cleanup?${params}`, {
      method: "DELETE",
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default ApiClient;
