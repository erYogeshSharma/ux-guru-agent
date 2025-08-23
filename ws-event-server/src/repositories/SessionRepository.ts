import { Session } from "@/entities";
import { BaseRepository } from "./BaseRepository";

export class SessionRepository extends BaseRepository<Session> {
  constructor() {
    super(Session);
  }

  async findByIdWithOrganization(sessionId: string): Promise<Session | null> {
    return await this.repository.findOne({
      where: { id: sessionId },
      relations: ["organization"],
    });
  }

  async findActiveSessions(): Promise<Session[]> {
    return await this.repository.find({
      where: { isActive: true },
      relations: ["organization"],
      order: { updatedAt: "DESC" },
    });
  }

  async findActiveSessionsByOrganization(
    organizationId: string
  ): Promise<Session[]> {
    return await this.repository.find({
      where: { organizationId, isActive: true },
      order: { updatedAt: "DESC" },
    });
  }

  async findSessionsByOrganization(
    organizationId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<Session[]> {
    return await this.repository.find({
      where: { organizationId },
      order: { updatedAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  async findAllSessions(
    limit: number = 100,
    offset: number = 0
  ): Promise<Session[]> {
    return await this.repository.find({
      relations: ["organization"],
      order: { updatedAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  async createSession(sessionData: {
    id: string;
    userId: string;
    organizationId: string;
    metadata: any;
  }): Promise<Session> {
    return await this.create({
      ...sessionData,
      isActive: true,
      eventCount: 0,
      errorCount: 0,
    });
  }

  async endSession(sessionId: string): Promise<void> {
    await this.repository.update(sessionId, {
      isActive: false,
      endedAt: new Date(),
    });
  }

  async incrementEventCount(sessionId: string, count: number): Promise<void> {
    await this.repository.increment({ id: sessionId }, "eventCount", count);
    await this.repository.update(sessionId, { updatedAt: new Date() });
  }

  async incrementErrorCount(sessionId: string): Promise<void> {
    await this.repository.increment({ id: sessionId }, "errorCount", 1);
    await this.repository.update(sessionId, { updatedAt: new Date() });
  }

  async countActiveSessions(): Promise<number> {
    return await this.repository.count({ where: { isActive: true } });
  }

  async getTotalEventCount(): Promise<number> {
    const result = await this.repository
      .createQueryBuilder("session")
      .select("SUM(session.eventCount)", "totalEvents")
      .getRawOne();

    return parseInt(result?.totalEvents || "0");
  }

  async cleanupOldSessions(maxAgeHours: number = 24): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);

    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(Session)
      .where("isActive = false AND updatedAt < :cutoffDate", { cutoffDate })
      .execute();

    return result.affected || 0;
  }
}
