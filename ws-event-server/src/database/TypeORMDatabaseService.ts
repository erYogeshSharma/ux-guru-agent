import "reflect-metadata";
import { Repository } from "typeorm";
import AppDataSource from "@/config/data-source";
import {
  Organization,
  User,
  Session,
  SessionEvent,
  SessionError,
  UserRole,
  OrganizationStatus,
} from "@/entities";
import { logger, dbLogger } from "@/utils/logger";

export class TypeORMDatabaseService {
  private organizationRepository!: Repository<Organization>;
  private userRepository!: Repository<User>;
  private sessionRepository!: Repository<Session>;
  private sessionEventRepository!: Repository<SessionEvent>;
  private sessionErrorRepository!: Repository<SessionError>;

  private isInitialized = false;

  constructor() {
    // Repositories will be initialized after connection
  }

  async initialize(): Promise<void> {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        logger.info("📊 TypeORM Database connection established successfully");
      }

      this.organizationRepository = AppDataSource.getRepository(Organization);
      this.userRepository = AppDataSource.getRepository(User);
      this.sessionRepository = AppDataSource.getRepository(Session);
      this.sessionEventRepository = AppDataSource.getRepository(SessionEvent);
      this.sessionErrorRepository = AppDataSource.getRepository(SessionError);

      this.isInitialized = true;
      dbLogger.connected();
    } catch (error) {
      dbLogger.connectionError(error);
      throw error;
    }
  }

  // Organization methods
  async createOrganization(organizationData: {
    name: string;
    email: string;
    companyName: string;
    website?: string;
    description?: string;
  }): Promise<Organization> {
    const organization = this.organizationRepository.create({
      ...organizationData,
      status: OrganizationStatus.ACTIVE,
      settings: {},
    });

    const savedOrganization = await this.organizationRepository.save(
      organization
    );
    logger.info(
      `📋 Organization created: ${savedOrganization.companyName} (${savedOrganization.email})`
    );
    return savedOrganization;
  }

  async getOrganizationByEmail(email: string): Promise<Organization | null> {
    return await this.organizationRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    return await this.organizationRepository.findOne({
      where: { id },
      relations: ["users"],
    });
  }

  async updateOrganization(
    id: string,
    updates: Partial<Organization>
  ): Promise<Organization | null> {
    await this.organizationRepository.update(id, updates);
    return await this.getOrganizationById(id);
  }

  // User methods
  async createUser(userData: {
    name: string;
    email: string;
    passwordHash: string;
    organizationId: string;
    role?: UserRole;
  }): Promise<User> {
    const user = this.userRepository.create({
      ...userData,
      role: userData.role || UserRole.VIEWER,
      preferences: {},
    });

    const savedUser = await this.userRepository.save(user);
    logger.info(`👤 User created: ${savedUser.name} (${savedUser.email})`);
    return savedUser;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
      relations: ["organization"],
    });
  }

  async getUserById(id: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id },
      relations: ["organization"],
    });
  }

  async getUsersByOrganization(organizationId: string): Promise<User[]> {
    return await this.userRepository.find({
      where: { organizationId },
      order: { createdAt: "DESC" },
    });
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    await this.userRepository.update(id, updates);
    return await this.getUserById(id);
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, { lastLoginAt: new Date() });
  }

  // Session methods
  async createSession(sessionData: {
    id: string;
    userId: string;
    organizationId: string;
    metadata: any;
  }): Promise<Session> {
    const session = this.sessionRepository.create({
      ...sessionData,
      isActive: true,
      eventCount: 0,
      errorCount: 0,
    });

    return await this.sessionRepository.save(session);
  }

  async updateSession(
    sessionId: string,
    updates: Partial<Session>
  ): Promise<Session | null> {
    await this.sessionRepository.update(sessionId, updates);
    return await this.getSessionById(sessionId);
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    return await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ["organization"],
    });
  }

  async getActiveSessions(): Promise<Session[]> {
    return await this.sessionRepository.find({
      where: { isActive: true },
      relations: ["organization"],
      order: { updatedAt: "DESC" },
    });
  }

  async getActiveSessionsByOrganization(
    organizationId: string
  ): Promise<Session[]> {
    return await this.sessionRepository.find({
      where: { organizationId, isActive: true },
      order: { updatedAt: "DESC" },
    });
  }

  async getSessionsByOrganization(
    organizationId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<Session[]> {
    return await this.sessionRepository.find({
      where: { organizationId },
      order: { updatedAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  async getAllSessions(
    limit: number = 100,
    offset: number = 0
  ): Promise<Session[]> {
    return await this.sessionRepository.find({
      relations: ["organization"],
      order: { updatedAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  async endSession(sessionId: string): Promise<void> {
    await this.sessionRepository.update(sessionId, {
      isActive: false,
      endedAt: new Date(),
    });
  }

  // Session Events methods
  async addSessionEvents(sessionId: string, events: any[]): Promise<void> {
    const sessionEvent = this.sessionEventRepository.create({
      sessionId,
      events,
      eventCount: events.length,
    });

    await this.sessionEventRepository.save(sessionEvent);

    // Update session event count
    await this.sessionRepository.increment(
      { id: sessionId },
      "eventCount",
      events.length
    );
    await this.sessionRepository.update(sessionId, { updatedAt: new Date() });

    dbLogger.batchInserted(events.length);
  }

  async getSessionEvents(
    sessionId: string,
    fromIndex: number = 0,
    limit: number = 1000
  ): Promise<any[]> {
    const sessionEvents = await this.sessionEventRepository.find({
      where: { sessionId },
      order: { createdAt: "ASC" },
    });

    // Flatten all events into a single array
    const allEvents: any[] = [];
    for (const eventBatch of sessionEvents) {
      if (Array.isArray(eventBatch.events)) {
        allEvents.push(...eventBatch.events);
      }
    }

    // Apply pagination
    return allEvents.slice(fromIndex, fromIndex + limit);
  }

  // Session Errors methods
  async addSessionError(sessionId: string, errorData: any): Promise<void> {
    const sessionError = this.sessionErrorRepository.create({
      sessionId,
      errorData,
    });

    await this.sessionErrorRepository.save(sessionError);

    // Update session error count
    await this.sessionRepository.increment({ id: sessionId }, "errorCount", 1);
    await this.sessionRepository.update(sessionId, { updatedAt: new Date() });
  }

  async getSessionErrors(sessionId: string): Promise<SessionError[]> {
    return await this.sessionErrorRepository.find({
      where: { sessionId },
      order: { createdAt: "DESC" },
    });
  }

  // Cleanup methods
  async cleanupOldSessions(maxAgeHours: number = 24): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);

    const result = await this.sessionRepository
      .createQueryBuilder()
      .delete()
      .from(Session)
      .where("isActive = false AND updatedAt < :cutoffDate", { cutoffDate })
      .execute();

    const deletedCount = result.affected || 0;
    if (deletedCount > 0) {
      dbLogger.cleanup(deletedCount);
    }

    return deletedCount;
  }

  // Stats methods
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    totalEvents: number;
    totalOrganizations: number;
    totalUsers: number;
  }> {
    const [
      totalSessions,
      activeSessions,
      totalOrganizations,
      totalUsers,
      eventStats,
    ] = await Promise.all([
      this.sessionRepository.count(),
      this.sessionRepository.count({ where: { isActive: true } }),
      this.organizationRepository.count(),
      this.userRepository.count(),
      this.sessionRepository
        .createQueryBuilder("session")
        .select("SUM(session.eventCount)", "totalEvents")
        .getRawOne(),
    ]);

    return {
      totalSessions,
      activeSessions,
      totalEvents: parseInt(eventStats?.totalEvents || "0"),
      totalOrganizations,
      totalUsers,
    };
  }

  async shutdown(): Promise<void> {
    logger.info("🛑 Shutting down TypeORM database service...");

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.info("🗄️ Database connection closed");
    }
  }
}

export default TypeORMDatabaseService;
