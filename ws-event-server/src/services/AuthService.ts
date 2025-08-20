import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { DatabaseService } from "../database";
import {
  Organization,
  AuthRequest,
  LoginRequest,
  AuthResponse,
} from "../types";
import { logger } from "../utils/logger";

export class AuthService {
  private dbService: DatabaseService;
  private jwtSecret: string;

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
    this.jwtSecret =
      process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this";

    if (this.jwtSecret === "your-super-secret-jwt-key-change-this") {
      logger.warn(
        "⚠️ Using default JWT secret. Please set JWT_SECRET environment variable in production!"
      );
    }
  }

  async signup(request: AuthRequest): Promise<AuthResponse> {
    try {
      // Check if organization with this email already exists
      const existingOrg = await this.getOrganizationByEmail(request.email);
      if (existingOrg) {
        return {
          success: false,
          message: "Organization with this email already exists",
        };
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(request.password, saltRounds);

      // Create organization
      const organizationId = randomUUID();
      const organization: Organization = {
        id: organizationId,
        name: request.name,
        companyName: request.companyName,
        email: request.email.toLowerCase(),
        passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      await this.createOrganization(organization);

      // Generate JWT token
      const token = this.generateToken(organizationId);

      return {
        success: true,
        token,
        organization: {
          id: organization.id,
          name: organization.name,
          companyName: organization.companyName,
          email: organization.email,
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
      // Get organization by email
      const organization = await this.getOrganizationByEmail(request.email);
      if (!organization) {
        return {
          success: false,
          message: "Invalid email or password",
        };
      }

      // Check if organization is active
      if (!organization.isActive) {
        return {
          success: false,
          message: "Organization account is deactivated",
        };
      }

      // Verify password
      const passwordValid = await bcrypt.compare(
        request.password,
        organization.passwordHash
      );
      if (!passwordValid) {
        return {
          success: false,
          message: "Invalid email or password",
        };
      }

      // Generate JWT token
      const token = this.generateToken(organization.id);

      return {
        success: true,
        token,
        organization: {
          id: organization.id,
          name: organization.name,
          companyName: organization.companyName,
          email: organization.email,
        },
      };
    } catch (error) {
      logger.error("Signin error:", error);
      return {
        success: false,
        message: "Failed to sign in",
      };
    }
  }

  verifyToken(token: string): { valid: boolean; organizationId?: string } {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as {
        organizationId: string;
      };
      return {
        valid: true,
        organizationId: decoded.organizationId,
      };
    } catch (error) {
      return {
        valid: false,
      };
    }
  }

  private generateToken(organizationId: string): string {
    return jwt.sign(
      { organizationId },
      this.jwtSecret,
      { expiresIn: "7d" } // Token expires in 7 days
    );
  }

  private async createOrganization(organization: Organization): Promise<void> {
    await this.dbService.createOrganization(organization);
  }

  private async getOrganizationByEmail(
    email: string
  ): Promise<Organization | null> {
    return await this.dbService.getOrganizationByEmail(email.toLowerCase());
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    return await this.dbService.getOrganizationById(id);
  }
}

export default AuthService;
