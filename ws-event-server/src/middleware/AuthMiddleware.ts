import { FastifyRequest, FastifyReply } from "fastify";
import { AuthController } from "@/controllers/authController";
import { AuthService } from "@/services/AuthService";
import { User, UserRole } from "@/entities";

export interface AuthenticatedRequest extends FastifyRequest {
  userId?: string;
  organizationId?: string;
  user?: User;
  userRole?: UserRole;
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor(authService: AuthService) {
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
      const authController = new AuthController(this.authService);
      const verification = await authController.verifyToken(token);

      if (!verification?.userId || !verification?.organizationId) {
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

      console.log(user);

      if (!user.organization || user.organization.status !== "active") {
        return reply.status(401).send({
          error: "Organization not found or inactive",
        });
      }

      // Set user info in request
      request.userId = user.id;
      request.organizationId = user.organization.id;
      request.user = user;
      request.userRole = user.role;
    } catch (error) {
      return reply.status(401).send({
        error: "Authentication failed",
      });
    }
  };

  // Middleware for admin-only routes
  requireAdmin = async (request: AuthenticatedRequest, reply: FastifyReply) => {
    // First authenticate
    await this.authenticate(request, reply);

    // Check if response was already sent (authentication failed)
    if (reply.sent) {
      return;
    }

    if (request.userRole !== UserRole.ADMIN) {
      return reply.status(403).send({
        error: "Admin access required",
      });
    }
  };

  // Middleware for manager+ level access (admin or manager)
  requireManager = async (
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) => {
    // First authenticate
    await this.authenticate(request, reply);

    // Check if response was already sent (authentication failed)
    if (reply.sent) {
      return;
    }

    if (
      request.userRole !== UserRole.ADMIN &&
      request.userRole !== UserRole.MANAGER
    ) {
      return reply.status(403).send({
        error: "Manager or Admin access required",
      });
    }
  };

  // Helper method to check if user has permission for specific role
  hasRole = (requiredRole: UserRole) => {
    return async (request: AuthenticatedRequest, reply: FastifyReply) => {
      // First authenticate
      await this.authenticate(request, reply);

      // Check if response was already sent (authentication failed)
      if (reply.sent) {
        return;
      }

      // Role hierarchy: ADMIN > MANAGER > VIEWER
      const roleHierarchy = {
        [UserRole.ADMIN]: 3,
        [UserRole.MANAGER]: 2,
        [UserRole.VIEWER]: 1,
      };

      const userLevel = roleHierarchy[request.userRole!] || 0;
      const requiredLevel = roleHierarchy[requiredRole] || 0;

      if (userLevel < requiredLevel) {
        return reply.status(403).send({
          error: `${requiredRole} access required`,
        });
      }
    };
  };
}
