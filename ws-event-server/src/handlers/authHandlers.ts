import { FastifyRequest, FastifyReply } from "fastify";
import {
  AuthController,
  SignupRequest,
  LoginRequest,
  CreateUserRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  RefreshTokenRequest,
} from "@/controllers/authController";
import { AuthenticatedRequest } from "@/middleware/AuthMiddleware";
import { logger } from "@/utils/logger";

export class AuthHandlers {
  static async signup(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authController = new AuthController(request.server.authService);
      const signupRequest = request.body as SignupRequest;
      const result = await authController.signup(signupRequest);

      if (result.success) {
        return reply.status(201).send(result);
      } else {
        return reply.status(400).send(result);
      }
    } catch (error) {
      logger.error("Signup handler error:", error);
      return reply.status(500).send({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async signin(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authController = new AuthController(request.server.authService);
      const loginRequest = request.body as LoginRequest;
      const result = await authController.signin(loginRequest);

      if (result.success) {
        return reply.status(200).send(result);
      } else {
        return reply.status(401).send(result);
      }
    } catch (error) {
      logger.error("Signin handler error:", error);
      return reply.status(401).send({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async me(request: AuthenticatedRequest, reply: FastifyReply) {
    return {
      success: true,
      user: {
        id: request.user!.id,
        name: request.user!.name,
        email: request.user!.email,
        role: request.user!.role,
        organization: {
          id: request.user!.organization.id,
          name: request.user!.organization.name,
          companyName: request.user!.organization.companyName,
          email: request.user!.organization.email,
        },
      },
    };
  }

  static async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authController = new AuthController(request.server.authService);
      const forgotPasswordRequest = request.body as ForgotPasswordRequest;
      const result = await authController.forgotPassword(forgotPasswordRequest);
      return reply.status(200).send(result);
    } catch (error) {
      logger.error("Forgot password handler error:", error);
      return reply.status(400).send({
        success: false,
        message: "Failed to process password reset request",
      });
    }
  }

  static async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authController = new AuthController(request.server.authService);
      const resetPasswordRequest = request.body as ResetPasswordRequest;
      const result = await authController.resetPassword(resetPasswordRequest);

      if (result.success) {
        return reply.status(200).send(result);
      } else {
        return reply.status(400).send(result);
      }
    } catch (error) {
      logger.error("Reset password handler error:", error);
      return reply.status(400).send({
        success: false,
        message: "Failed to reset password",
      });
    }
  }

  static async refresh(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authController = new AuthController(request.server.authService);
      const refreshTokenRequest = request.body as RefreshTokenRequest;
      const result = await authController.refreshToken(refreshTokenRequest);

      if (result.success) {
        return reply.status(200).send(result);
      } else {
        return reply.status(401).send(result);
      }
    } catch (error) {
      logger.error("Refresh token handler error:", error);
      return reply.status(401).send({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }
  }

  static async createUser(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const authController = new AuthController(request.server.authService);
      const createUserRequest = request.body as CreateUserRequest;

      // Force organization ID to be the authenticated user's organization
      createUserRequest.organizationId = request.organizationId!;

      const result = await authController.createUser(
        createUserRequest,
        request.userId!
      );

      if (result.success) {
        return reply.status(201).send(result);
      } else {
        return reply.status(400).send(result);
      }
    } catch (error) {
      logger.error("Create user handler error:", error);
      return reply.status(500).send({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async getUsers(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const authController = new AuthController(request.server.authService);
      const users = await authController.getOrganizationUsers(
        request.organizationId!
      );

      // Remove password hashes from response
      const safeUsers = users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      }));

      return { users: safeUsers };
    } catch (error) {
      logger.error("Get users handler error:", error);
      return reply.status(500).send({
        error: "Failed to fetch users",
      });
    }
  }
}
