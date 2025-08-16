import { Pool, PoolClient } from "pg";
import { config } from "../config";
import { logger, dbLogger } from "../utils/logger";
import { SessionBatch } from "../types";

export class DatabaseService {
  private pool: Pool;
  private sessionBatchQueue: SessionBatch[] = [];
  private batchInterval?: NodeJS.Timeout;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      max: config.database.max,
      idleTimeoutMillis: config.database.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.connectionTimeoutMillis,
    });

    this.pool.on("connect", () => {
      dbLogger.connected();
    });

    this.pool.on("error", (err) => {
      dbLogger.connectionError(err);
    });

    this.initializeDatabase();
    this.startBatchProcessor();
  }

  private async initializeDatabase(): Promise<void> {
    const client = await this.pool.connect();

    try {
      // Create sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(255) UNIQUE NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          metadata JSONB NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create events table
      await client.query(`
        CREATE TABLE IF NOT EXISTS session_events (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(255) NOT NULL,
          events JSONB NOT NULL,
          event_count INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        )
      `);

      // Create errors table
      await client.query(`
        CREATE TABLE IF NOT EXISTS session_errors (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(255) NOT NULL,
          error_data JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        )
      `);

      // Create indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
        CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id);
        CREATE INDEX IF NOT EXISTS idx_session_events_created_at ON session_events(created_at);
        CREATE INDEX IF NOT EXISTS idx_session_errors_session_id ON session_errors(session_id);
      `);

      logger.info("📊 Database tables initialized successfully");
    } catch (error) {
      dbLogger.queryError("Database initialization", error);
      throw error;
    } finally {
      client.release();
    }
  }

  private startBatchProcessor(): void {
    this.batchInterval = setInterval(async () => {
      if (this.sessionBatchQueue.length > 0) {
        await this.processBatch();
      }
    }, config.batchInterval);
  }

  private async processBatch(): Promise<void> {
    if (this.sessionBatchQueue.length === 0) return;

    const batchToProcess = this.sessionBatchQueue.splice(0, config.batchSize);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      for (const batch of batchToProcess) {
        // Upsert session
        await client.query(
          `
          INSERT INTO sessions (session_id, user_id, metadata, is_active, updated_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          ON CONFLICT (session_id) 
          DO UPDATE SET 
            metadata = $3,
            is_active = $4,
            updated_at = CURRENT_TIMESTAMP
        `,
          [batch.sessionId, batch.userId, batch.metadata, batch.isActive]
        );

        // Insert events if any
        if (batch.events && batch.events.length > 0) {
          await client.query(
            `
            INSERT INTO session_events (session_id, events, event_count)
            VALUES ($1, $2, $3)
          `,
            [batch.sessionId, JSON.stringify(batch.events), batch.events.length]
          );
        }

        // Insert errors if any
        if (batch.errors && batch.errors.length > 0) {
          for (const error of batch.errors) {
            await client.query(
              `
              INSERT INTO session_errors (session_id, error_data)
              VALUES ($1, $2)
            `,
              [batch.sessionId, JSON.stringify(error)]
            );
          }
        }
      }

      await client.query("COMMIT");
      dbLogger.batchInserted(batchToProcess.length);
    } catch (error) {
      await client.query("ROLLBACK");
      dbLogger.queryError("Batch processing", error);

      // Put failed batches back in queue for retry
      this.sessionBatchQueue.unshift(...batchToProcess);
    } finally {
      client.release();
    }
  }

  public queueSessionBatch(batch: SessionBatch): void {
    this.sessionBatchQueue.push(batch);

    // Force immediate processing if queue is getting large
    if (this.sessionBatchQueue.length >= config.batchSize * 2) {
      this.processBatch();
    }
  }

  public async getSessionEvents(
    sessionId: string,
    fromIndex = 0,
    limit = 1000
  ): Promise<any[]> {
    const client = await this.pool.connect();

    try {
      // Fetch all rows for the session ordered by creation so we can
      // provide event-level pagination (fromIndex/limit across the
      // concatenated event stream) rather than row-level pagination.
      const result = await client.query(
        `
        SELECT events, created_at
        FROM session_events
        WHERE session_id = $1
        ORDER BY created_at ASC
      `,
        [sessionId]
      );

      const allEvents: any[] = [];
      for (const row of result.rows) {
        if (Array.isArray(row.events)) {
          allEvents.push(...row.events);
        }
      }

      // Slice according to requested fromIndex and limit (event-level)
      return allEvents.slice(fromIndex, fromIndex + limit);
    } catch (error) {
      dbLogger.queryError(`Get session events for ${sessionId}`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  public async getActiveSessions(): Promise<any[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT 
          s.session_id,
          s.user_id,
          s.metadata,
          s.created_at,
          s.updated_at,
          COALESCE(SUM(se.event_count), 0) as event_count,
          COUNT(ser.id) as error_count
        FROM sessions s
        LEFT JOIN session_events se ON s.session_id = se.session_id
        LEFT JOIN session_errors ser ON s.session_id = ser.session_id
        WHERE s.is_active = true
        GROUP BY s.session_id, s.user_id, s.metadata, s.created_at, s.updated_at
        ORDER BY s.updated_at DESC
      `);

      // Format the data to match expected API structure
      return result.rows.map((row) => ({
        sessionId: row.session_id,
        userId: row.user_id,
        metadata: {
          ...row.metadata,
          // Ensure required fields exist with defaults
          viewport: row.metadata.viewport || {
            width: 1920,
            height: 1080,
            devicePixelRatio: 1,
          },
          referrer: row.metadata.referrer || "",
          timeZone: row.metadata.timeZone || "UTC",
        },
        eventCount: parseInt(row.event_count) || 0,
        errorCount: parseInt(row.error_count) || 0,
        isActive: true,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      dbLogger.queryError("Get active sessions", error);
      throw error;
    } finally {
      client.release();
    }
  }

  public async getAllSessions(
    limit: number = 100,
    offset: number = 0
  ): Promise<any[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `
        SELECT 
          s.session_id,
          s.user_id,
          s.metadata,
          s.is_active,
          s.created_at,
          s.updated_at,
          COALESCE(SUM(se.event_count), 0) as event_count,
          COUNT(ser.id) as error_count
        FROM sessions s
        LEFT JOIN session_events se ON s.session_id = se.session_id
        LEFT JOIN session_errors ser ON s.session_id = ser.session_id
        GROUP BY s.session_id, s.user_id, s.metadata, s.is_active, s.created_at, s.updated_at
        ORDER BY s.updated_at DESC
        LIMIT $1 OFFSET $2
      `,
        [limit, offset]
      );

      // Format the data to match expected API structure
      return result.rows.map((row) => ({
        sessionId: row.session_id,
        userId: row.user_id,
        metadata: {
          ...row.metadata,
          // Ensure required fields exist with defaults
          viewport: row.metadata.viewport || {
            width: 1920,
            height: 1080,
            devicePixelRatio: 1,
          },
          referrer: row.metadata.referrer || "",
          timeZone: row.metadata.timeZone || "UTC",
        },
        eventCount: parseInt(row.event_count) || 0,
        errorCount: parseInt(row.error_count) || 0,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      dbLogger.queryError("Get all sessions", error);
      throw error;
    } finally {
      client.release();
    }
  }

  public async cleanupOldSessions(maxAgeHours = 24): Promise<number> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        DELETE FROM sessions
        WHERE is_active = false 
        AND updated_at < CURRENT_TIMESTAMP - INTERVAL '${maxAgeHours} hours'
      `);

      const deletedCount = result.rowCount || 0;
      if (deletedCount > 0) {
        dbLogger.cleanup(deletedCount);
      }

      return deletedCount;
    } catch (error) {
      dbLogger.queryError("Cleanup old sessions", error);
      throw error;
    } finally {
      client.release();
    }
  }

  public async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    totalEvents: number;
  }> {
    const client = await this.pool.connect();

    try {
      const sessionStats = await client.query(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN is_active THEN 1 END) as active_sessions
        FROM sessions
      `);

      const eventStats = await client.query(`
        SELECT COALESCE(SUM(event_count), 0) as total_events
        FROM session_events
      `);

      return {
        totalSessions: parseInt(sessionStats.rows[0].total_sessions),
        activeSessions: parseInt(sessionStats.rows[0].active_sessions),
        totalEvents: parseInt(eventStats.rows[0].total_events),
      };
    } catch (error) {
      dbLogger.queryError("Get database stats", error);
      throw error;
    } finally {
      client.release();
    }
  }

  public async shutdown(): Promise<void> {
    logger.info("🛑 Shutting down database service...");

    if (this.batchInterval) {
      clearInterval(this.batchInterval);
    }

    // Process any remaining batches
    if (this.sessionBatchQueue.length > 0) {
      logger.info(
        `📦 Processing ${this.sessionBatchQueue.length} remaining batches...`
      );
      await this.processBatch();
    }

    await this.pool.end();
    logger.info("🗄️ Database connection pool closed");
  }
}

export default DatabaseService;
