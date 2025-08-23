import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AuthService } from "@/services/AuthService";
import { UserRole, UserStatus } from "@/entities";
import { logger } from "@/utils/logger";
import { config } from "@/config";

export interface SignupRequest {
  name: string;
  email: string;
  companyName: string;
  password: string;
  website?: string;
  description?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organizationId: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    organization: {
      id: string;
      name: string;
      companyName: string;
      email: string;
    };
  };
  message?: string;
}

export class AuthController {
  private authService: AuthService;
  private jwtSecret: string;
  private refreshTokenSecret: string;

  constructor(authService: AuthService) {
    this.authService = authService;
    this.jwtSecret = config.secrets.jwt;
    this.refreshTokenSecret = config.secrets.refreshToken;

    if (this.jwtSecret === "default_jwt") {
      logger.warn(
        "⚠️ Using default JWT secret. Please set JWT_SECRET environment variable in production!"
      );
    }

    if (this.refreshTokenSecret === "default_refresh_token") {
      logger.warn(
        "⚠️ Using default Refresh Token secret. Please set REFRESH_TOKEN_SECRET environment variable in production!"
      );
    }
  }

  async signup(request: SignupRequest): Promise<AuthResponse> {
    try {
      // Validation
      if (
        !request.name ||
        !request.email ||
        !request.companyName ||
        !request.password
      ) {
        return {
          success: false,
          message:
            "All fields are required: name, email, companyName, password",
        };
      }

      if (request.password.length < 6) {
        return {
          success: false,
          message: "Password must be at least 6 characters long",
        };
      }

      // Check if organization already exists
      const existingOrg = await this.authService.getOrganizationByEmail(
        request.email
      );
      if (existingOrg) {
        return {
          success: false,
          message: "Organization with this email already exists",
        };
      }

      // Check if user already exists
      const existingUser = await this.authService.getUserByEmail(request.email);
      if (existingUser) {
        return {
          success: false,
          message: "User with this email already exists",
        };
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(request.password, saltRounds);

      // Create organization
      const organization = await this.authService.createOrganization({
        name: request.name, // Admin's name for organization name initially
        email: request.email.toLowerCase(),
        companyName: request.companyName,
        website: request.website,
        description: request.description,
      });

      // Create admin user
      const user = await this.authService.createUser({
        name: request.name,
        email: request.email.toLowerCase(),
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        organizationId: organization.id,
      });

      const token = this.generateToken(user.id, organization.id);
      const refreshToken = this.generateRefreshToken(user.id, organization.id);

      return {
        success: true,
        token,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization: {
            id: organization.id,
            name: organization.name,
            companyName: organization.companyName,
            email: organization.email,
          },
        },
      };
    } catch (error) {
      logger.error("Signup error:", error);
      return {
        success: false,
        message: "Failed to create organization",
      };
    }
  }

  async signin(request: LoginRequest): Promise<AuthResponse> {
    try {
      // Validation
      if (!request.email || !request.password) {
        return {
          success: false,
          message: "Email and password are required",
        };
      }

      // Get user by email
      const user = await this.authService.getUserByEmail(request.email);
      if (!user) {
        return {
          success: false,
          message: "Invalid email or password",
        };
      }

      // Check if user is active
      if (user.status !== UserStatus.ACTIVE) {
        return {
          success: false,
          message: "User account is not active",
        };
      }

      // Check if organization is active
      if (!user.organization || user.organization.status !== "active") {
        return {
          success: false,
          message: "Organization account is not active",
        };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(
        request.password,
        user.passwordHash
      );
      if (!isValidPassword) {
        return {
          success: false,
          message: "Invalid email or password",
        };
      }

      // Update last login
      await this.authService.updateUserLastLogin(user.id);

      // Generate JWT token and refresh token
      const token = this.generateToken(user.id, user.organization.id);
      const refreshToken = this.generateRefreshToken(
        user.id,
        user.organization.id
      );

      return {
        success: true,
        token,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization: {
            id: user.organization.id,
            name: user.organization.name,
            companyName: user.organization.companyName,
            email: user.organization.email,
          },
        },
      };
    } catch (error) {
      logger.error("Signin error:", error);
      return {
        success: false,
        message: "Internal server error",
      };
    }
  }

  async createUser(
    request: CreateUserRequest,
    createdBy: string
  ): Promise<AuthResponse> {
    try {
      // Validation
      if (
        !request.name ||
        !request.email ||
        !request.password ||
        !request.role
      ) {
        return {
          success: false,
          message: "All fields are required: name, email, password, role",
        };
      }

      // Check if user with this email already exists
      const existingUser = await this.authService.getUserByEmail(request.email);
      if (existingUser) {
        return {
          success: false,
          message: "User with this email already exists",
        };
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(request.password, saltRounds);

      // Create user
      const user = await this.authService.createUser({
        name: request.name,
        email: request.email.toLowerCase(),
        passwordHash,
        organizationId: request.organizationId,
        role: request.role,
      });

      // Get organization details for response
      const organization = await this.authService.getOrganizationById(
        request.organizationId
      );
      if (!organization) {
        throw new Error("Organization not found");
      }

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization: {
            id: organization.id,
            name: organization.name,
            companyName: organization.companyName,
            email: organization.email,
          },
        },
      };
    } catch (error) {
      logger.error("Create user error:", error);
      return {
        success: false,
        message: "Failed to create user",
      };
    }
  }

  async getOrganizationUsers(organizationId: string) {
    return this.authService.getOrganizationUsers(organizationId);
  }

  async forgotPassword(request: ForgotPasswordRequest) {
    try {
      const user = await this.authService.getUserByEmail(request.email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return {
          success: true,
          message:
            "If an account with that email exists, we've sent a password reset link.",
        };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour

      // In a real application, you would:
      // 1. Store the reset token and expiry in the database
      // 2. Send an email with the reset link

      // For demonstration, we'll return a mock reset link
      const resetLink = `${config.frontendUrl}/reset-password?token=${resetToken}`;

      return {
        success: true,
        message: "Password reset link sent to your email",
        resetLink, // Remove this in production
      };
    } catch (error) {
      logger.error("Forgot password error:", error);
      return {
        success: false,
        message: "Failed to process password reset request",
      };
    }
  }

  async resetPassword(request: ResetPasswordRequest) {
    try {
      // In a real application, you would:
      // 1. Validate the reset token
      // 2. Check if it's not expired
      // 3. Find the user associated with the token
      // 4. Update their password

      // For demonstration, we'll just return a success message
      return {
        success: true,
        message: "Password has been reset successfully",
      };
    } catch (error) {
      logger.error("Reset password error:", error);
      return {
        success: false,
        message: "Failed to reset password",
      };
    }
  }

  async refreshToken(request: RefreshTokenRequest): Promise<AuthResponse> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(
        request.refreshToken,
        this.refreshTokenSecret
      ) as any;

      // Get user and organization
      const user = await this.authService.getUserById(decoded.userId);
      if (!user || !user.organization) {
        return {
          success: false,
          message: "Invalid refresh token",
        };
      }

      // Generate new tokens
      const token = this.generateToken(user.id, user.organization.id);
      const refreshToken = this.generateRefreshToken(
        user.id,
        user.organization.id
      );

      return {
        success: true,
        token,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization: {
            id: user.organization.id,
            name: user.organization.name,
            companyName: user.organization.companyName,
            email: user.organization.email,
          },
        },
      };
    } catch (error) {
      logger.error("Refresh token error:", error);
      return {
        success: false,
        message: "Invalid or expired refresh token",
      };
    }
  }

  async verifyToken(
    token: string
  ): Promise<{ userId: string; organizationId: string } | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      return { userId: decoded.userId, organizationId: decoded.organizationId };
    } catch (error) {
      return null;
    }
  }

  private generateToken(userId: string, organizationId: string): string {
    return jwt.sign({ userId, organizationId }, this.jwtSecret, {
      expiresIn: "1h",
    }) as string;
  }

  private generateRefreshToken(userId: string, organizationId: string): string {
    return jwt.sign({ userId, organizationId }, this.refreshTokenSecret, {
      expiresIn: "7d",
    }) as string;
  }
}
