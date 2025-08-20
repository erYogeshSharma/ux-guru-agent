import { FastifyRequest, FastifyReply } from "fastify";
import { TypeORMAuthService } from "@/services/TypeORMAuthService";
import { User, UserRole } from "@/entities";

export interface AuthenticatedRequest extends FastifyRequest {
  userId?: string;
  organizationId?: string;
  user?: User;
  userRole?: UserRole;
}

export class TypeORMAuthMiddleware {
  private authService: TypeORMAuthService;

  constructor(authService: TypeORMAuthService) {
    this.authService = authService;
  }

  // Middleware for protecting routes
  authenticate = async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.status(401).send({
          error: "Authorization token required",
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const verification = this.authService.verifyToken(token);

      if (
        !verification.valid ||
        !verification.userId ||
        !verification.organizationId
      ) {
        return reply.status(401).send({
          error: "Invalid or expired token",
        });
      }

      // Get user details
      const user = await this.authService.getUserById(verification.userId);

      if (!user || user.status !== "active") {
        return reply.status(401).send({
          error: "User not found or inactive",
        });
      }

      // Verify organization matches
      if (user.organizationId !== verification.organizationId) {
        return reply.status(401).send({
          error: "Organization mismatch",
        });
      }

      // Add user info to request
      request.userId = user.id;
      request.organizationId = user.organizationId;
      request.user = user;
      request.userRole = user.role;
    } catch (error) {
      return reply.status(500).send({
        error: "Authentication failed",
      });
    }
  };

  // Middleware that requires specific roles
  requireRole = (requiredRoles: UserRole | UserRole[]) => {
    const roles = Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles];

    return async (request: AuthenticatedRequest, reply: FastifyReply) => {
      // First authenticate
      await this.authenticate(request, reply);

      // Check if response was already sent (authentication failed)
      if (reply.sent) {
        return;
      }

      // Check role
      if (!request.userRole || !roles.includes(request.userRole)) {
        return reply.status(403).send({
          error: "Insufficient permissions",
        });
      }
    };
  };

  // Middleware for admin-only routes
  requireAdmin = async (request: AuthenticatedRequest, reply: FastifyReply) => {
    return this.requireRole(UserRole.ADMIN)(request, reply);
  };

  // Middleware for admin or manager routes
  requireManager = async (
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) => {
    return this.requireRole([UserRole.ADMIN, UserRole.MANAGER])(request, reply);
  };

  // Optional middleware that doesn't fail if no auth is provided
  optionalAuthenticate = async (
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return; // Continue without authentication
      }

      const token = authHeader.substring(7);
      const verification = this.authService.verifyToken(token);

      if (
        verification.valid &&
        verification.userId &&
        verification.organizationId
      ) {
        const user = await this.authService.getUserById(verification.userId);

        if (
          user &&
          user.status === "active" &&
          user.organizationId === verification.organizationId
        ) {
          request.userId = user.id;
          request.organizationId = user.organizationId;
          request.user = user;
          request.userRole = user.role;
        }
      }
    } catch (error) {
      // Ignore authentication errors for optional auth
    }
  };
}

export default TypeORMAuthMiddleware;
