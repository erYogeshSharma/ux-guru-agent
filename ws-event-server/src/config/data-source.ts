import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "@/config";
import {
  Organization,
  User,
  Session,
  SessionEvent,
  SessionError,
} from "@/entities";
import path from "path";

const AppDataSource = new DataSource({
  type: "postgres",
  host: config.database.host,
  port: config.database.port,
  username: config.database.user,
  password: config.database.password,
  database: config.database.database,
  synchronize: false, // Use migrations instead
  logging: config.logger.level === "debug",
  entities: [Organization, User, Session, SessionEvent, SessionError],
  // load any migration file from src/migrations (ts for dev, js for built output)
  migrations: [path.join(process.cwd(), "src/migrations/*{.ts,.js}")],
  migrationsTableName: "migrations",
  migrationsRun: false,
  subscribers: [],
});

export default AppDataSource;
