import { SessionEvent } from "@/entities";
import { BaseRepository } from "./BaseRepository";
import { dbLogger } from "@/utils/logger";

export class SessionEventRepository extends BaseRepository<SessionEvent> {
  constructor() {
    super(SessionEvent);
  }

  async addSessionEvents(sessionId: string, events: any[]): Promise<void> {
    const sessionEvent = await this.create({
      sessionId,
      events,
      eventCount: events.length,
    });

    dbLogger.batchInserted(events.length);
  }

  async findBySessionId(sessionId: string): Promise<SessionEvent[]> {
    return await this.repository.find({
      where: { sessionId },
      order: { createdAt: "ASC" },
    });
  }

  async getSessionEvents(
    sessionId: string,
    fromIndex: number = 0,
    limit: number = 1000
  ): Promise<any[]> {
    const sessionEvents = await this.findBySessionId(sessionId);

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
}
