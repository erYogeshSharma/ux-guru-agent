import { Organization, OrganizationStatus } from "@/entities";
import { BaseRepository } from "./BaseRepository";
import { logger } from "@/utils/logger";

export class OrganizationRepository extends BaseRepository<Organization> {
  constructor() {
    super(Organization);
  }

  async findByEmail(email: string): Promise<Organization | null> {
    return await this.repository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  async findByIdWithUsers(id: string): Promise<Organization | null> {
    return await this.repository.findOne({
      where: { id },
      relations: ["users"],
    });
  }

  async createOrganization(organizationData: {
    name: string;
    email: string;
    companyName: string;
    website?: string;
    description?: string;
  }): Promise<Organization> {
    const organization = await this.create({
      ...organizationData,
      status: OrganizationStatus.ACTIVE,
      settings: {},
    });

    logger.info(
      `📋 Organization created: ${organization.companyName} (${organization.email})`
    );
    return organization;
  }

  async updateOrganization(
    id: string,
    updates: Partial<Organization>
  ): Promise<Organization | null> {
    return await this.update(id, updates);
  }
}
