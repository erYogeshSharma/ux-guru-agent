import { FastifyRequest, FastifyReply } from "fastify";
import AuthService from "../services/AuthService";

export interface AuthenticatedRequest extends FastifyRequest {
  organizationId?: string;
  organization?: {
    id: string;
    name: string;
    companyName: string;
    email: string;
  };
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
      const verification = this.authService.verifyToken(token);

      if (!verification.valid || !verification.organizationId) {
        return reply.status(401).send({
          error: "Invalid or expired token",
        });
      }

      // Get organization details
      const organization = await this.authService.getOrganizationById(
        verification.organizationId
      );

      if (!organization || !organization.isActive) {
        return reply.status(401).send({
          error: "Organization not found or inactive",
        });
      }

      // Add organization info to request
      request.organizationId = organization.id;
      request.organization = {
        id: organization.id,
        name: organization.name,
        companyName: organization.companyName,
        email: organization.email,
      };
    } catch (error) {
      return reply.status(500).send({
        error: "Authentication failed",
      });
    }
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

      if (verification.valid && verification.organizationId) {
        const organization = await this.authService.getOrganizationById(
          verification.organizationId
        );

        if (organization && organization.isActive) {
          request.organizationId = organization.id;
          request.organization = {
            id: organization.id,
            name: organization.name,
            companyName: organization.companyName,
            email: organization.email,
          };
        }
      }
    } catch (error) {
      // Ignore authentication errors for optional auth
    }
  };
}

export default AuthMiddleware;
