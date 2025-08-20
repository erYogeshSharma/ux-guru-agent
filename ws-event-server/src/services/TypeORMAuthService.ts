import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { TypeORMDatabaseService } from "@/database/TypeORMDatabaseService";
import { Organization, User, UserRole, UserStatus } from "@/entities";
import { logger } from "@/utils/logger";

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

export interface AuthResponse {
  success: boolean;
  token?: string;
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

export class TypeORMAuthService {
  private dbService: TypeORMDatabaseService;
  private jwtSecret: string;

  constructor(dbService: TypeORMDatabaseService) {
    this.dbService = dbService;
    this.jwtSecret =
      process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this";

    if (this.jwtSecret === "your-super-secret-jwt-key-change-this") {
      logger.warn(
        "⚠️ Using default JWT secret. Please set JWT_SECRET environment variable in production!"
      );
    }
  }

  async signup(request: SignupRequest): Promise<AuthResponse> {
    try {
      // Check if organization with this email already exists
      const existingOrg = await this.dbService.getOrganizationByEmail(
        request.email
      );
      if (existingOrg) {
        return {
          success: false,
          message: "Organization with this email already exists",
        };
      }

      // Check if user with this email already exists
      const existingUser = await this.dbService.getUserByEmail(request.email);
      if (existingUser) {
        return {
          success: false,
          message: "User with this email already exists",
        };
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(request.password, saltRounds);

      // Create organization first
      const organization = await this.dbService.createOrganization({
        name: request.name, // Admin's name for organization name initially
        email: request.email.toLowerCase(),
        companyName: request.companyName,
        website: request.website,
        description: request.description,
      });

      // Create admin user for the organization
      const user = await this.dbService.createUser({
        name: request.name,
        email: request.email.toLowerCase(),
        passwordHash,
        organizationId: organization.id,
        role: UserRole.ADMIN,
      });

      // Generate JWT token
      const token = this.generateToken(user.id, organization.id);

      return {
        success: true,
        token,
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
      // Get user by email
      const user = await this.dbService.getUserByEmail(request.email);
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
      const passwordValid = await bcrypt.compare(
        request.password,
        user.passwordHash
      );
      if (!passwordValid) {
        return {
          success: false,
          message: "Invalid email or password",
        };
      }

      // Update last login
      await this.dbService.updateUserLastLogin(user.id);

      // Generate JWT token
      const token = this.generateToken(user.id, user.organizationId);

      return {
        success: true,
        token,
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
        message: "Failed to sign in",
      };
    }
  }

  async createUser(
    request: CreateUserRequest,
    creatorId: string
  ): Promise<AuthResponse> {
    try {
      // Get creator to verify they have permission
      const creator = await this.dbService.getUserById(creatorId);
      if (!creator) {
        return {
          success: false,
          message: "Creator not found",
        };
      }

      // Check if creator has permission (admin or manager)
      if (
        creator.role !== UserRole.ADMIN &&
        creator.role !== UserRole.MANAGER
      ) {
        return {
          success: false,
          message: "Insufficient permissions to create users",
        };
      }

      // Check if user is in the same organization
      if (creator.organizationId !== request.organizationId) {
        return {
          success: false,
          message: "Cannot create user in different organization",
        };
      }

      // Check if user with this email already exists
      const existingUser = await this.dbService.getUserByEmail(request.email);
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
      const user = await this.dbService.createUser({
        name: request.name,
        email: request.email.toLowerCase(),
        passwordHash,
        organizationId: request.organizationId,
        role: request.role,
      });

      // Get organization details
      const organization = await this.dbService.getOrganizationById(
        user.organizationId
      );

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization: organization
            ? {
                id: organization.id,
                name: organization.name,
                companyName: organization.companyName,
                email: organization.email,
              }
            : undefined,
        } as any,
      };
    } catch (error) {
      logger.error("Create user error:", error);
      return {
        success: false,
        message: "Failed to create user",
      };
    }
  }

  verifyToken(token: string): {
    valid: boolean;
    userId?: string;
    organizationId?: string;
  } {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as {
        userId: string;
        organizationId: string;
      };
      return {
        valid: true,
        userId: decoded.userId,
        organizationId: decoded.organizationId,
      };
    } catch (error) {
      return {
        valid: false,
      };
    }
  }

  private generateToken(userId: string, organizationId: string): string {
    return jwt.sign(
      { userId, organizationId },
      this.jwtSecret,
      { expiresIn: "7d" } // Token expires in 7 days
    );
  }

  async getUserById(id: string): Promise<User | null> {
    return await this.dbService.getUserById(id);
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    return await this.dbService.getOrganizationById(id);
  }

  async getOrganizationUsers(organizationId: string): Promise<User[]> {
    return await this.dbService.getUsersByOrganization(organizationId);
  }
}

export default TypeORMAuthService;
