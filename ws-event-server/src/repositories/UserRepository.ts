import { User, UserRole } from "@/entities";
import { BaseRepository } from "./BaseRepository";
import { logger } from "@/utils/logger";

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(User);
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.repository.findOne({
      where: { email: email.toLowerCase() },
      relations: ["organization"],
    });
  }

  async findByResetToken(resetToken: string): Promise<User | null> {
    return await this.repository.findOne({
      where: { resetToken },
      relations: ["organization"],
    });
  }

  async findByIdWithOrganization(id: string): Promise<User | null> {
    return await this.repository.findOne({
      where: { id },
      relations: ["organization"],
    });
  }

  async findByOrganization(organizationId: string): Promise<User[]> {
    return await this.repository.find({
      where: { organizationId },
      order: { createdAt: "DESC" },
    });
  }

  async createUser(userData: {
    name: string;
    email: string;
    passwordHash: string;
    organizationId: string;
    role?: UserRole;
  }): Promise<User> {
    const user = await this.create({
      ...userData,
      role: userData.role || UserRole.VIEWER,
      preferences: {},
    });

    logger.info(`👤 User created: ${user.name} (${user.email})`);
    return user;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.repository.update(id, { lastLoginAt: new Date() });
  }

  async resetUserPassword(
    resetToken: string,
    newPasswordHash: string
  ): Promise<{ success: boolean; user?: User; message?: string }> {
    try {
      logger.info(
        `🔍 Attempting to reset password with token: ${resetToken.substring(
          0,
          8
        )}...`
      );

      // Start a transaction to ensure atomicity
      return await this.repository.manager.transaction(
        async (transactionalEntityManager) => {
          // Find and lock the user with the reset token
          const user = await transactionalEntityManager.findOne(User, {
            where: { resetToken },
            relations: ["organization"],
          });

          if (!user) {
            logger.info(
              `❌ No user found with reset token: ${resetToken.substring(
                0,
                8
              )}...`
            );
            return {
              success: false,
              message: "Invalid or expired reset token",
            };
          }

          logger.info(
            `✅ Found user: ${user.email} with token: ${resetToken.substring(
              0,
              8
            )}...`
          );

          // Check if token is expired
          if (
            !user.resetTokenExpiresAt ||
            user.resetTokenExpiresAt < new Date()
          ) {
            logger.info(
              `⏰ Token expired for user: ${user.email}, clearing token`
            );
            // Clear expired token using query builder to ensure null values
            await transactionalEntityManager
              .createQueryBuilder()
              .update(User)
              .set({
                resetToken: () => "NULL",
                resetTokenExpiresAt: () => "NULL",
              })
              .where("id = :id", { id: user.id })
              .execute();

            return {
              success: false,
              message: "Reset token has expired",
            };
          }

          logger.info(
            `🔄 Updating password and clearing token for user: ${user.email}`
          );

          // Update password and clear reset token atomically using query builder
          const updateResult = await transactionalEntityManager
            .createQueryBuilder()
            .update(User)
            .set({
              passwordHash: newPasswordHash,
              resetToken: () => "NULL",
              resetTokenExpiresAt: () => "NULL",
            })
            .where("id = :id", { id: user.id })
            .execute();

          logger.info(
            `✅ Password updated and token cleared for user: ${user.email}, affected rows: ${updateResult.affected}`
          );

          // Return updated user
          const updatedUser = await transactionalEntityManager.findOne(User, {
            where: { id: user.id },
            relations: ["organization"],
          });

          return {
            success: true,
            user: updatedUser!,
          };
        }
      );
    } catch (error) {
      logger.error("Reset password transaction error:", error);
      return {
        success: false,
        message: "Failed to reset password",
      };
    }
  }
}
