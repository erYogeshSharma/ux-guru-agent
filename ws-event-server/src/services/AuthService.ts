import { UserRepository, OrganizationRepository } from "@/repositories";
import { Organization, User, UserRole, UserStatus } from "@/entities";
import { logger } from "@/utils/logger";

export class AuthService {
  private userRepository: UserRepository;
  private organizationRepository: OrganizationRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.organizationRepository = new OrganizationRepository();
  }

  // User operations
  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findByIdWithOrganization(id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async createUser(userData: {
    name: string;
    email: string;
    passwordHash: string;
    organizationId: string;
    role: UserRole;
    status?: UserStatus;
  }): Promise<User> {
    return this.userRepository.createUser(userData);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    return this.userRepository.update(id, updates);
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, { lastLoginAt: new Date() });
  }

  async getOrganizationUsers(organizationId: string): Promise<User[]> {
    return this.userRepository.findByOrganization(organizationId);
  }

  // Organization operations
  async getOrganizationById(id: string): Promise<Organization | null> {
    return this.organizationRepository.findById(id);
  }

  async getOrganizationByEmail(email: string): Promise<Organization | null> {
    return this.organizationRepository.findByEmail(email);
  }

  async createOrganization(orgData: {
    name: string;
    email: string;
    companyName: string;
    website?: string;
    description?: string;
  }): Promise<Organization> {
    return this.organizationRepository.createOrganization(orgData);
  }

  async updateOrganization(
    id: string,
    updates: Partial<Organization>
  ): Promise<Organization | null> {
    return this.organizationRepository.update(id, updates);
  }

  // Token storage operations (for refresh tokens)
  async storeRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date
  ): Promise<void> {
    // Store refresh token in database
    logger.info(`Storing refresh token for user ${userId}`);
  }

  async validateRefreshToken(
    token: string
  ): Promise<{ userId: string; organizationId: string } | null> {
    // Validate refresh token from database
    logger.info(`Validating refresh token`);
    return null; // Implement based on your token storage strategy
  }

  async revokeRefreshToken(token: string): Promise<void> {
    // Revoke refresh token in database
    logger.info(`Revoking refresh token`);
  }
}
