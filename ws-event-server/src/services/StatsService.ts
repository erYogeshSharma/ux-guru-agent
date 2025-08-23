import {
  OrganizationRepository,
  UserRepository,
  SessionRepository,
} from "@/repositories";

export interface DatabaseStats {
  totalSessions: number;
  activeSessions: number;
  totalEvents: number;
  totalOrganizations: number;
  totalUsers: number;
}

export class StatsService {
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;
  private sessionRepository: SessionRepository;

  constructor() {
    this.organizationRepository = new OrganizationRepository();
    this.userRepository = new UserRepository();
    this.sessionRepository = new SessionRepository();
  }

  async getDatabaseStats(): Promise<DatabaseStats> {
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
      this.sessionRepository.getTotalEventCount(),
    ]);

    return {
      totalSessions,
      activeSessions,
      totalEvents: eventStats || 0,
      totalOrganizations,
      totalUsers,
    };
  }
}
