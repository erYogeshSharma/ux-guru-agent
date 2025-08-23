import { EventEmitter } from "events";
import {
  SessionRepository,
  SessionEventRepository,
  SessionErrorRepository,
} from "@/repositories";
import { Session, SessionEvent } from "@/entities";
import { logger } from "@/utils/logger";

export interface SessionData {
  sessionId: string;
  userId: string;
  organizationId: string;
  events: any[];
  metadata: any;
  isActive: boolean;
  errors: any[];
}

export class SessionService extends EventEmitter {
  private sessions = new Map<string, SessionData>();
  private sessionRepository: SessionRepository;
  private sessionEventRepository: SessionEventRepository;
  private sessionErrorRepository: SessionErrorRepository;

  constructor() {
    super();
    this.sessionRepository = new SessionRepository();
    this.sessionEventRepository = new SessionEventRepository();
    this.sessionErrorRepository = new SessionErrorRepository();
  }

  // Session operations
  async getSessionById(sessionId: string): Promise<Session | null> {
    return this.sessionRepository.findById(sessionId);
  }

  async createSession(sessionData: {
    id: string;
    userId: string;
    organizationId: string;
    metadata: any;
  }): Promise<Session> {
    return this.sessionRepository.createSession(sessionData);
  }

  async updateSession(
    sessionId: string,
    updates: Partial<Session>
  ): Promise<Session | null> {
    return this.sessionRepository.update(sessionId, updates);
  }

  async getActiveSessionsByOrganization(
    organizationId: string
  ): Promise<Session[]> {
    return this.sessionRepository.findActiveSessionsByOrganization(
      organizationId
    );
  }

  async getSessionsByOrganization(
    organizationId: string,
    limit: number,
    offset: number
  ): Promise<Session[]> {
    return this.sessionRepository.findSessionsByOrganization(
      organizationId,
      limit,
      offset
    );
  }

  // Event operations
  async addSessionEvents(sessionId: string, events: any[]): Promise<void> {
    return this.sessionEventRepository.addSessionEvents(sessionId, events);
  }

  async getSessionEvents(
    sessionId: string,
    fromIndex: number,
    limit: number
  ): Promise<SessionEvent[]> {
    return this.sessionEventRepository.getSessionEvents(
      sessionId,
      fromIndex,
      limit
    );
  }

  // Memory cache operations for real-time features
  getMemorySession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  setMemorySession(sessionId: string, sessionData: SessionData): void {
    this.sessions.set(sessionId, sessionData);
    this.emit("sessionStarted", sessionData);
  }

  updateMemorySession(
    sessionId: string,
    updates: Partial<SessionData>
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    Object.assign(session, updates);
    this.emit("sessionUpdated", session);
    return true;
  }

  removeMemorySession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.sessions.delete(sessionId);
    this.emit("sessionEnded", session);
    return true;
  }

  addEventsToMemorySession(sessionId: string, events: any[]): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.events.push(...events);
    session.metadata.lastActivity = Date.now();

    this.emit("eventsAdded", { sessionId, events });
    return true;
  }

  // Statistics
  getStats() {
    return {
      activeSessions: this.sessions.size,
      totalEvents: Array.from(this.sessions.values()).reduce(
        (total, session) => total + session.events.length,
        0
      ),
    };
  }

  // Cleanup
  cleanup(): void {
    this.sessions.clear();
  }
}
