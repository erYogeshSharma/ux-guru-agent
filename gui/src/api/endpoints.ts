// API Endpoints Configuration
export const API_ENDPOINTS = {
  // Base URLs for different services
  BASE: {
    AUTH_SERVER: process.env.VITE_AUTH_SERVER_URL || "http://localhost:8000",
    SESSION_SERVER:
      process.env.VITE_SESSION_SERVER_URL || "http://localhost:8000",
    // Add more services here as needed
  },

  // Authentication endpoints
  AUTH: {
    SIGNUP: "/auth/signup",
    SIGNIN: "/auth/signin",
    ME: "/auth/me",
    USERS: "/auth/users",
    REFRESH: "/auth/refresh",
  },

  // Session endpoints
  SESSIONS: {
    ACTIVE: "/sessions/active",
    ALL: "/sessions",
    EVENTS: (sessionId: string) => `/sessions/${sessionId}/events`,
    CLEANUP: "/sessions/cleanup",
  },

  // Health and stats endpoints
  HEALTH: "/health",
  STATS: "/stats",

  // WebSocket endpoints
  WEBSOCKET: "/ws",
} as const;

console.log(API_ENDPOINTS);
// HTTP Methods
export const HTTP_METHODS = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
  PATCH: "PATCH",
} as const;

// Request configuration types
export interface RequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, string | number>;
  timeout?: number;
}

export interface ApiEndpoint {
  method: keyof typeof HTTP_METHODS;
  url: string;
  requiresAuth?: boolean;
}

// Predefined endpoint configurations
export const ENDPOINT_CONFIGS: Record<string, ApiEndpoint> = {
  // Auth endpoints
  SIGNUP: {
    method: "POST",
    url: API_ENDPOINTS.AUTH.SIGNUP,
    requiresAuth: false,
  },
  SIGNIN: {
    method: "POST",
    url: API_ENDPOINTS.AUTH.SIGNIN,
    requiresAuth: false,
  },
  GET_ME: {
    method: "GET",
    url: API_ENDPOINTS.AUTH.ME,
    requiresAuth: true,
  },
  CREATE_USER: {
    method: "POST",
    url: API_ENDPOINTS.AUTH.USERS,
    requiresAuth: true,
  },
  GET_USERS: {
    method: "GET",
    url: API_ENDPOINTS.AUTH.USERS,
    requiresAuth: true,
  },

  // Session endpoints
  GET_ACTIVE_SESSIONS: {
    method: "GET",
    url: API_ENDPOINTS.SESSIONS.ACTIVE,
    requiresAuth: true,
  },
  GET_ALL_SESSIONS: {
    method: "GET",
    url: API_ENDPOINTS.SESSIONS.ALL,
    requiresAuth: true,
  },
  CLEANUP_SESSIONS: {
    method: "DELETE",
    url: API_ENDPOINTS.SESSIONS.CLEANUP,
    requiresAuth: true,
  },

  // Health and stats
  HEALTH_CHECK: {
    method: "GET",
    url: API_ENDPOINTS.HEALTH,
    requiresAuth: false,
  },
  GET_STATS: {
    method: "GET",
    url: API_ENDPOINTS.STATS,
    requiresAuth: false,
  },
} as const;
