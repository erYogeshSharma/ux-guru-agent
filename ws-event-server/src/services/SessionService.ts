import { EventEmitter } from "events";
import { SessionData, SessionBatch } from "../types";
import { config } from "../config";
import { sessionLogger } from "../utils/logger";
import DatabaseService from "../database";

export class SessionService extends EventEmitter {
  private sessions = new Map<string, SessionData>();
  private dbService: DatabaseService;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(dbService: DatabaseService) {
    super();
    this.dbService = dbService;
    this.startPeriodicCleanup();
  }

  public createSession(
    sessionData: Omit<SessionData, "events" | "errors" | "isActive">
  ): SessionData {
    const session: SessionData = {
      ...sessionData,
      events: [],
      errors: [],
      isActive: true,
    };

    this.sessions.set(sessionData.sessionId, session);
    sessionLogger.sessionStarted(sessionData.sessionId, sessionData.userId);

    // Queue initial session data for database
    this.queueSessionForDatabase(session);

    this.emit("sessionStarted", session);
    return session;
  }

  public addEventsToSession(sessionId: string, events: any[]): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.events.push(...events);
    session.metadata.lastActivity = Date.now();

    // Limit events per session to prevent memory issues
    if (session.events.length > config.maxEventsPerSession) {
      const originalCount = session.events.length;
      session.events = session.events.slice(
        -Math.floor(config.maxEventsPerSession / 2)
      );
      sessionLogger.sessionTrimmed(
        sessionId,
        originalCount,
        session.events.length
      );
    }

    // Queue events for database in batches
    this.queueEventsForDatabase(session, events);

    this.emit("eventsAdded", { sessionId, events });
    return true;
  }

  public addErrorToSession(sessionId: string, error: any): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.errors.push(error);
    sessionLogger.sessionError(sessionId, error);

    // Queue error for database
    this.queueErrorForDatabase(session, error);

    this.emit("errorAdded", { sessionId, error });
    return true;
  }

  public endSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.isActive = false;
    sessionLogger.sessionEnded(sessionId);

    // Queue final session state for database
    this.queueSessionForDatabase(session);

    this.emit("sessionEnded", session);
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

  public getSessionEvents(
    sessionId: string,
    fromIndex = 0,
    limit = 1000
  ): any[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    return session.events.slice(fromIndex, fromIndex + limit);
  }

  public updateSessionHeartbeat(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.metadata.lastActivity = Date.now();
    return true;
  }

  private queueSessionForDatabase(session: SessionData): void {
    const batch: SessionBatch = {
      sessionId: session.sessionId,
      userId: session.userId,
      events: [], // Events are queued separately
      metadata: session.metadata,
      isActive: session.isActive,
      errors: [], // Errors are queued separately
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.dbService.queueSessionBatch(batch);
  }

  private queueEventsForDatabase(session: SessionData, events: any[]): void {
    const batch: SessionBatch = {
      sessionId: session.sessionId,
      userId: session.userId,
      events: events,
      metadata: session.metadata,
      isActive: session.isActive,
      errors: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.dbService.queueSessionBatch(batch);
    sessionLogger.batchSaved(session.sessionId, events.length);
  }

  private queueErrorForDatabase(session: SessionData, error: any): void {
    const batch: SessionBatch = {
      sessionId: session.sessionId,
      userId: session.userId,
      events: [],
      metadata: session.metadata,
      isActive: session.isActive,
      errors: [error],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.dbService.queueSessionBatch(batch);
  }

  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldSessions();
    }, config.sessionCleanupInterval);
  }

  private cleanupOldSessions(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
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
        `Cleaned up ${sessionsToDelete.length} old sessions`
      );
    }

    // Also cleanup database
    this.dbService.cleanupOldSessions(24);
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

    // Queue all remaining sessions for database
    this.sessions.forEach((session) => {
      this.queueSessionForDatabase(session);
    });

    this.emit("shutdown");
  }
}

export default SessionService;
