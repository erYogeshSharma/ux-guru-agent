import { SessionService } from "@/services/SessionService";
import { config } from "@/config";
import { logger } from "@/utils/logger";

export class SessionController {
  private sessionService: SessionService;

  constructor(sessionService: SessionService) {
    this.sessionService = sessionService;
  }

  async getActiveSessions(organizationId: string) {
    try {
      const activeSessions =
        await this.sessionService.getActiveSessionsByOrganization(
          organizationId
        );
      return { sessions: activeSessions };
    } catch (error) {
      logger.error("Get active sessions error:", error);
      throw new Error("Failed to fetch active sessions");
    }
  }

  async getAllSessions(
    organizationId: string,
    limit: number = 100,
    offset: number = 0
  ) {
    try {
      const allSessions = await this.sessionService.getSessionsByOrganization(
        organizationId,
        limit,
        offset
      );
      return { sessions: allSessions, limit, offset };
    } catch (error) {
      logger.error("Get all sessions error:", error);
      throw new Error("Failed to fetch session history");
    }
  }

  async getSessionEvents(
    sessionId: string,
    organizationId: string,
    fromIndex: number = 0,
    limit: number = 1000
  ) {
    try {
      // Verify session belongs to the organization
      const session = await this.sessionService.getSessionById(sessionId);
      if (!session || session.organizationId !== organizationId) {
        throw new Error("Session not found");
      }

      const events = await this.sessionService.getSessionEvents(
        sessionId,
        fromIndex,
        limit
      );

      return {
        sessionId,
        events,
        fromIndex,
        count: events.length,
      };
    } catch (error) {
      logger.error("Get session events error:", error);
      throw error;
    }
  }

  async createSession(sessionData: {
    sessionId: string;
    userId: string;
    organizationId: string;
    metadata: any;
  }) {
    try {
      // Create session in database
      const session = await this.sessionService.createSession({
        id: sessionData.sessionId,
        userId: sessionData.userId,
        organizationId: sessionData.organizationId,
        metadata: sessionData.metadata,
      });

      // Add to memory for real-time features
      this.sessionService.setMemorySession(sessionData.sessionId, {
        sessionId: sessionData.sessionId,
        userId: sessionData.userId,
        organizationId: sessionData.organizationId,
        events: [],
        errors: [],
        isActive: true,
        metadata: sessionData.metadata,
      });

      return session;
    } catch (error) {
      logger.error("Create session error:", error);
      throw new Error("Failed to create session");
    }
  }

  async addEventsToSession(sessionId: string, events: any[]) {
    try {
      // Get or create memory session
      let memorySession = this.sessionService.getMemorySession(sessionId);
      if (!memorySession) {
        // Session might not be in memory but could exist in DB
        const dbSession = await this.sessionService.getSessionById(sessionId);
        if (!dbSession) {
          throw new Error("Session not found");
        }

        // Recreate session in memory
        memorySession = {
          sessionId: dbSession.id,
          userId: dbSession.userId,
          organizationId: dbSession.organizationId,
          metadata: dbSession.metadata,
          events: [],
          errors: [],
          isActive: dbSession.isActive,
        };
        this.sessionService.setMemorySession(sessionId, memorySession);
      }

      // Add events to memory session
      this.sessionService.addEventsToMemorySession(sessionId, events);

      // Limit events per session to prevent memory issues
      if (memorySession.events.length > config.maxEventsPerSession) {
        const originalCount = memorySession.events.length;
        memorySession.events = memorySession.events.slice(
          -Math.floor(config.maxEventsPerSession / 2)
        );
        logger.info(
          `Session ${sessionId} trimmed from ${originalCount} to ${memorySession.events.length} events`
        );
      }

      // Add events to database
      await this.sessionService.addSessionEvents(sessionId, events);

      return true;
    } catch (error) {
      logger.error("Add events to session error:", error);
      throw new Error("Failed to add events to session");
    }
  }

  async endSession(sessionId: string) {
    try {
      // Update session in database
      await this.sessionService.updateSession(sessionId, {
        isActive: false,
        endedAt: new Date(),
      });

      // Remove from memory
      this.sessionService.removeMemorySession(sessionId);

      return true;
    } catch (error) {
      logger.error("End session error:", error);
      throw new Error("Failed to end session");
    }
  }

  async cleanupOldSessions(maxAgeHours: number = 24) {
    try {
      // This would be implemented in the database service
      // For now, return a mock count
      const deletedCount = 0; // await this.sessionService.cleanupOldSessions(maxAgeHours);

      return {
        message: `Cleaned up ${deletedCount} old sessions`,
        deletedCount,
      };
    } catch (error) {
      logger.error("Cleanup sessions error:", error);
      throw new Error("Failed to cleanup sessions");
    }
  }

  getStats() {
    return this.sessionService.getStats();
  }

  shutdown() {
    this.sessionService.cleanup();
  }
}
