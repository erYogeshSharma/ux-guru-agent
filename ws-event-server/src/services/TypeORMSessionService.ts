import { EventEmitter } from "events";
import { Session } from "@/entities";
import "reflect-metadata";
import AppDataSource from "@/config/data-source";
import { config } from "@/config";
import { sessionLogger } from "@/utils/logger";
import { TypeORMDatabaseService } from "@/database/TypeORMDatabaseService";

export interface SessionData {
  sessionId: string;
  userId: string;
  organizationId: string;
  events: any[];
  metadata: any;
  isActive: boolean;
  errors: any[];
}

export class TypeORMSessionService extends EventEmitter {
  private sessions = new Map<string, SessionData>();
  private dbService: TypeORMDatabaseService;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(dbService: TypeORMDatabaseService) {
    super();
    this.dbService = dbService;
    this.startPeriodicCleanup();
  }

  public async createSession(
    sessionData: Omit<SessionData, "events" | "errors" | "isActive">
  ): Promise<SessionData> {
    const session: SessionData = {
      ...sessionData,
      events: [],
      errors: [],
      isActive: true,
    };

    this.sessions.set(sessionData.sessionId, session);
    sessionLogger.sessionStarted(sessionData.sessionId, sessionData.userId);

    // Create session in database
    await this.dbService.createSession({
      id: sessionData.sessionId,
      userId: sessionData.userId,
      organizationId: sessionData.organizationId,
      metadata: sessionData.metadata,
    });

    this.emit("sessionStarted", session);
    return session;
  }

  public async addEventsToSession(
    sessionId: string,
    events: any[]
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      // Session might not be in memory but could exist in DB
      const dbSession = await this.dbService.getSessionById(sessionId);
      if (!dbSession) {
        return false;
      }
      // Recreate session in memory
      const sessionData: SessionData = {
        sessionId: dbSession.id,
        userId: dbSession.userId,
        organizationId: dbSession.organizationId,
        metadata: dbSession.metadata,
        events: [],
        errors: [],
        isActive: dbSession.isActive,
      };
      this.sessions.set(sessionId, sessionData);
    }

    const currentSession = this.sessions.get(sessionId)!;
    currentSession.events.push(...events);
    currentSession.metadata.lastActivity = Date.now();

    // Limit events per session to prevent memory issues
    if (currentSession.events.length > config.maxEventsPerSession) {
      const originalCount = currentSession.events.length;
      currentSession.events = currentSession.events.slice(
        -Math.floor(config.maxEventsPerSession / 2)
      );
      sessionLogger.sessionTrimmed(
        sessionId,
        originalCount,
        currentSession.events.length
      );
    }

    // Add events to database
    await this.dbService.addSessionEvents(sessionId, events);

    this.emit("eventsAdded", { sessionId, events });
    return true;
  }

  public async addErrorToSession(
    sessionId: string,
    error: any
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      const dbSession = await this.dbService.getSessionById(sessionId);
      if (!dbSession) {
        return false;
      }
    }

    const currentSession = this.sessions.get(sessionId);
    if (currentSession) {
      currentSession.errors.push(error);
    }

    sessionLogger.sessionError(sessionId, error);

    // Add error to database
    await this.dbService.addSessionError(sessionId, error);

    this.emit("errorAdded", { sessionId, error });
    return true;
  }

  public async endSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
    }

    sessionLogger.sessionEnded(sessionId);

    // End session in database
    await this.dbService.endSession(sessionId);

    this.emit("sessionEnded", { sessionId });
    return true;
  }

  public getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  public getAllActiveSessions(): SessionData[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.isActive
    );
  }

  public async getActiveSessionsFromDB(): Promise<Session[]> {
    return await this.dbService.getActiveSessions();
  }

  public async getActiveSessionsByOrganization(
    organizationId: string
  ): Promise<Session[]> {
    return await this.dbService.getActiveSessionsByOrganization(organizationId);
  }

  public async getSessionEvents(
    sessionId: string,
    fromIndex = 0,
    limit = 1000
  ): Promise<any[]> {
    const session = this.sessions.get(sessionId);

    // If we have the session in memory, try to serve from it first.
    if (session) {
      const inMemory = session.events.slice(fromIndex, fromIndex + limit);

      // If we could fully satisfy the request from memory, return it.
      if (
        inMemory.length === Math.min(limit, session.events.length - fromIndex)
      ) {
        return inMemory;
      }
    }

    // Fallback: ask the database service for event-level pagination.
    try {
      const dbEvents = await this.dbService.getSessionEvents(
        sessionId,
        fromIndex,
        limit
      );
      return dbEvents;
    } catch (error) {
      // If DB failed, return an empty array to avoid breaking callers.
      return [];
    }
  }

  public updateSessionHeartbeat(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.metadata.lastActivity = Date.now();
    return true;
  }

  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldSessions();
    }, config.sessionCleanupInterval);
  }

  private async cleanupOldSessions(): Promise<void> {
    const now = Date.now();
    const maxAge = (config.sessionRetentionHours || 24) * 60 * 60 * 1000; // configurable hours
    const sessionsToDelete: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      const timeSinceLastActivity = now - session.metadata.lastActivity;

      if (!session.isActive && timeSinceLastActivity > maxAge) {
        sessionsToDelete.push(sessionId);
      }
    });

    sessionsToDelete.forEach((sessionId) => {
      this.sessions.delete(sessionId);
    });

    if (sessionsToDelete.length > 0) {
      sessionLogger.sessionEnded(
        `Cleaned up ${sessionsToDelete.length} old sessions from memory`
      );
    }

    // Also cleanup database
    await this.dbService.cleanupOldSessions(config.sessionRetentionHours || 24);
  }

  public getStats() {
    const totalEvents = Array.from(this.sessions.values()).reduce(
      (sum, session) => sum + session.events.length,
      0
    );

    return {
      totalSessions: this.sessions.size,
      activeSessions: this.getAllActiveSessions().length,
      totalEvents,
    };
  }

  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.emit("shutdown");
  }
}

export default TypeORMSessionService;
