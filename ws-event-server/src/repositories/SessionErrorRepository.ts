import { SessionError } from "@/entities";
import { BaseRepository } from "./BaseRepository";

export class SessionErrorRepository extends BaseRepository<SessionError> {
  constructor() {
    super(SessionError);
  }

  async addSessionError(sessionId: string, errorData: any): Promise<void> {
    await this.create({
      sessionId,
      errorData,
    });
  }

  async findBySessionId(sessionId: string): Promise<SessionError[]> {
    return await this.repository.find({
      where: { sessionId },
      order: { createdAt: "DESC" },
    });
  }
}
