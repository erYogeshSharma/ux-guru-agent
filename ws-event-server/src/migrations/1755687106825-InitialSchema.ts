import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1755687106825 implements MigrationInterface {
  name = "InitialSchema1755687106825";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create organizations table
    await queryRunner.query(`
            CREATE TYPE "organization_status_enum" AS ENUM('active', 'suspended', 'pending')
        `);

    await queryRunner.query(`
            CREATE TABLE "organizations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(255) NOT NULL,
                "email" character varying(255) NOT NULL,
                "companyName" character varying(255) NOT NULL,
                "status" "organization_status_enum" NOT NULL DEFAULT 'active',
                "settings" jsonb,
                "website" character varying(255),
                "description" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_organizations_email" UNIQUE ("email"),
                CONSTRAINT "PK_organizations" PRIMARY KEY ("id")
            )
        `);

    // Create users table
    await queryRunner.query(`
            CREATE TYPE "user_role_enum" AS ENUM('admin', 'manager', 'viewer')
        `);

    await queryRunner.query(`
            CREATE TYPE "user_status_enum" AS ENUM('active', 'inactive', 'suspended')
        `);

    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(255) NOT NULL,
                "email" character varying(255) NOT NULL,
                "passwordHash" character varying(255) NOT NULL,
                "role" "user_role_enum" NOT NULL DEFAULT 'viewer',
                "status" "user_status_enum" NOT NULL DEFAULT 'active',
                "lastLoginAt" TIMESTAMP,
                "resetToken" character varying(255),
                "resetTokenExpiresAt" TIMESTAMP,
                "preferences" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "organizationId" uuid NOT NULL,
                CONSTRAINT "UQ_users_email" UNIQUE ("email"),
                CONSTRAINT "PK_users" PRIMARY KEY ("id")
            )
        `);

    // Create sessions table
    await queryRunner.query(`
            CREATE TABLE "sessions" (
                "id" character varying(255) NOT NULL,
                "userId" character varying(255) NOT NULL,
                "metadata" jsonb NOT NULL,
                "isActive" boolean NOT NULL DEFAULT true,
                "eventCount" integer NOT NULL DEFAULT 0,
                "errorCount" integer NOT NULL DEFAULT 0,
                "endedAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "organizationId" uuid NOT NULL,
                CONSTRAINT "PK_sessions" PRIMARY KEY ("id")
            )
        `);

    // Create session_events table
    await queryRunner.query(`
            CREATE TABLE "session_events" (
                "id" SERIAL NOT NULL,
                "sessionId" character varying(255) NOT NULL,
                "events" jsonb NOT NULL,
                "eventCount" integer NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_session_events" PRIMARY KEY ("id")
            )
        `);

    // Create session_errors table
    await queryRunner.query(`
            CREATE TABLE "session_errors" (
                "id" SERIAL NOT NULL,
                "sessionId" character varying(255) NOT NULL,
                "errorData" jsonb NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_session_errors" PRIMARY KEY ("id")
            )
        `);

    // Create foreign key constraints
    await queryRunner.query(`
            ALTER TABLE "users" 
            ADD CONSTRAINT "FK_users_organizationId" 
            FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "sessions" 
            ADD CONSTRAINT "FK_sessions_organizationId" 
            FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "session_events" 
            ADD CONSTRAINT "FK_session_events_sessionId" 
            FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "session_errors" 
            ADD CONSTRAINT "FK_session_errors_sessionId" 
            FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE
        `);

    // Create indexes for better performance
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_userId" ON "sessions" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_organizationId" ON "sessions" ("organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_isActive" ON "sessions" ("isActive")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_createdAt" ON "sessions" ("createdAt")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_events_sessionId" ON "session_events" ("sessionId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_events_createdAt" ON "session_events" ("createdAt")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_errors_sessionId" ON "session_errors" ("sessionId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_organizationId" ON "users" ("organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_email" ON "users" ("email")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_organizations_email" ON "organizations" ("email")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints first
    await queryRunner.query(
      `ALTER TABLE "session_errors" DROP CONSTRAINT "FK_session_errors_sessionId"`
    );
    await queryRunner.query(
      `ALTER TABLE "session_events" DROP CONSTRAINT "FK_session_events_sessionId"`
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "FK_sessions_organizationId"`
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_users_organizationId"`
    );

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_organizations_email"`);
    await queryRunner.query(`DROP INDEX "IDX_users_email"`);
    await queryRunner.query(`DROP INDEX "IDX_users_organizationId"`);
    await queryRunner.query(`DROP INDEX "IDX_session_errors_sessionId"`);
    await queryRunner.query(`DROP INDEX "IDX_session_events_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_session_events_sessionId"`);
    await queryRunner.query(`DROP INDEX "IDX_sessions_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_sessions_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_sessions_organizationId"`);
    await queryRunner.query(`DROP INDEX "IDX_sessions_userId"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "session_errors"`);
    await queryRunner.query(`DROP TABLE "session_events"`);
    await queryRunner.query(`DROP TABLE "sessions"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "organizations"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "user_status_enum"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
    await queryRunner.query(`DROP TYPE "organization_status_enum"`);
  }
}
