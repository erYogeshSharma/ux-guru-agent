import { FastifyRequest, FastifyReply } from "fastify";

export class RootHandlers {
  static async root(request: FastifyRequest, reply: FastifyReply) {
    return {
      name: "Session Replay Server with TypeORM",
      version: "3.0.0",
      features: ["Multi-tenant", "Role-based access", "TypeORM", "PostgreSQL"],
      endpoints: {
        websocket: "/ws",
        health: "/health",
        stats: "/stats",
        auth: {
          signup: "POST /auth/signup",
          signin: "POST /auth/signin",
          me: "GET /auth/me",
          forgotPassword: "POST /auth/forgot-password",
          resetPassword: "POST /auth/reset-password",
          refresh: "POST /auth/refresh",
          users: {
            create: "POST /auth/users",
            list: "GET /auth/users",
          },
        },
        sessions: {
          active: "GET /sessions/active",
          all: "GET /sessions",
          events: "GET /sessions/:sessionId/events",
          cleanup: "DELETE /sessions/cleanup (admin only)",
        },
      },
      documentation:
        "Multi-tenant session replay server with role-based authentication. All session endpoints require authentication.",
    };
  }
}
