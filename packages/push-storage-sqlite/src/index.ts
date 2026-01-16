/**
 * @allmightypush/push-storage-sqlite
 * SQLite storage adapter for push notification library
 */

import Database from 'better-sqlite3';
import {
  StorageAdapter,
  Subscription,
  CreateSubscriptionData,
  SubscriptionFilter,
  RetryEntry,
  QueueStats,
  StorageError,
} from '@allmightypush/push-core';
import { randomUUID } from 'crypto';

/**
 * Configuration options for SQLite storage adapter
 */
export interface SQLiteStorageOptions {
  /** Path to the SQLite database file (or ':memory:' for in-memory database) */
  filename: string;
  /** Whether to enable WAL mode for better concurrency (default: true) */
  enableWAL?: boolean;
  /** Whether to run migrations automatically on initialization (default: true) */
  autoMigrate?: boolean;
}

/**
 * SQLite storage adapter implementation
 */
export class SQLiteStorageAdapter implements StorageAdapter {
  private db: Database.Database;
  private closed: boolean = false;

  constructor(options: SQLiteStorageOptions) {
    this.db = new Database(options.filename);

    // Enable WAL mode for better concurrency (default: true)
    if (options.enableWAL !== false) {
      this.db.pragma('journal_mode = WAL');
    }

    // Run migrations automatically if enabled (default: true)
    if (options.autoMigrate !== false) {
      this.migrateSync();
    }
  }

  /**
   * Run database migrations synchronously (called during construction)
   */
  private migrateSync(): void {
    // Create subscriptions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL,
        keys TEXT NOT NULL,
        user_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_used_at INTEGER,
        failed_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL CHECK(status IN ('active', 'blocked', 'expired')),
        expires_at INTEGER,
        metadata TEXT
      )
    `);

    // Create indexes for subscriptions table
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)
    `);

    // Create retry_queue table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS retry_queue (
        id TEXT PRIMARY KEY,
        subscription_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        attempt INTEGER NOT NULL,
        next_retry_at INTEGER NOT NULL,
        last_error TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
      )
    `);

    // Create index for retry_queue table
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_retry_queue_next_retry ON retry_queue(next_retry_at)
    `);
  }

  /**
   * Run database migrations (async version for StorageAdapter interface)
   */
  async migrate(): Promise<void> {
    this.migrateSync();
  }

  // Subscription management methods

  async createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
    this.ensureNotClosed();

    try {
      const id = randomUUID();
      const now = Date.now();

      const subscription: Subscription = {
        id,
        endpoint: data.endpoint,
        keys: data.keys,
        userId: data.userId,
        createdAt: new Date(now),
        updatedAt: new Date(now),
        failedCount: 0,
        status: 'active',
        expiresAt: data.expiresAt,
        metadata: data.metadata,
      };

      const stmt = this.db.prepare(`
        INSERT INTO subscriptions (
          id, endpoint, keys, user_id, created_at, updated_at,
          last_used_at, failed_count, status, expires_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        subscription.id,
        subscription.endpoint,
        JSON.stringify(subscription.keys),
        subscription.userId ?? null,
        now,
        now,
        null,
        subscription.failedCount,
        subscription.status,
        subscription.expiresAt ? subscription.expiresAt.getTime() : null,
        subscription.metadata ? JSON.stringify(subscription.metadata) : null
      );

      return subscription;
    } catch (error) {
      throw new StorageError(
        `Failed to create subscription: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'createSubscription',
          endpoint: data.endpoint,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  async getSubscriptionById(id: string): Promise<Subscription | null> {
    this.ensureNotClosed();

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM subscriptions WHERE id = ?
      `);

      const row = stmt.get(id) as any;

      if (!row) {
        return null;
      }

      return this.rowToSubscription(row);
    } catch (error) {
      throw new StorageError(
        `Failed to get subscription by id: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'getSubscriptionById',
          subscriptionId: id,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  async findSubscriptions(filter: SubscriptionFilter): Promise<Subscription[]> {
    this.ensureNotClosed();

    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter.userId !== undefined) {
        conditions.push('user_id = ?');
        params.push(filter.userId);
      }

      if (filter.status !== undefined) {
        conditions.push('status = ?');
        params.push(filter.status);
      }

      if (filter.ids !== undefined && filter.ids.length > 0) {
        const placeholders = filter.ids.map(() => '?').join(', ');
        conditions.push(`id IN (${placeholders})`);
        params.push(...filter.ids);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const stmt = this.db.prepare(`
        SELECT * FROM subscriptions ${whereClause}
      `);

      const rows = stmt.all(...params) as any[];

      return rows.map((row) => this.rowToSubscription(row));
    } catch (error) {
      throw new StorageError(
        `Failed to find subscriptions: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'findSubscriptions',
          filter,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    this.ensureNotClosed();

    try {
      // First, get the current subscription
      const current = await this.getSubscriptionById(id);
      if (!current) {
        throw new StorageError(`Subscription not found: ${id}`, {
          operation: 'updateSubscription',
          subscriptionId: id,
        });
      }

      // Build the update query dynamically based on provided fields
      const setClauses: string[] = [];
      const params: any[] = [];

      // Always update the updated_at timestamp
      setClauses.push('updated_at = ?');
      params.push(Date.now());

      if (updates.endpoint !== undefined) {
        setClauses.push('endpoint = ?');
        params.push(updates.endpoint);
      }

      if (updates.keys !== undefined) {
        setClauses.push('keys = ?');
        params.push(JSON.stringify(updates.keys));
      }

      if (updates.userId !== undefined) {
        setClauses.push('user_id = ?');
        params.push(updates.userId);
      }

      if (updates.lastUsedAt !== undefined) {
        setClauses.push('last_used_at = ?');
        params.push(updates.lastUsedAt ? updates.lastUsedAt.getTime() : null);
      }

      if (updates.failedCount !== undefined) {
        setClauses.push('failed_count = ?');
        params.push(updates.failedCount);
      }

      if (updates.status !== undefined) {
        setClauses.push('status = ?');
        params.push(updates.status);
      }

      if (updates.expiresAt !== undefined) {
        setClauses.push('expires_at = ?');
        params.push(updates.expiresAt ? updates.expiresAt.getTime() : null);
      }

      if (updates.metadata !== undefined) {
        setClauses.push('metadata = ?');
        params.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
      }

      // Add the id parameter for the WHERE clause
      params.push(id);

      const stmt = this.db.prepare(`
        UPDATE subscriptions
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `);

      stmt.run(...params);

      // Fetch and return the updated subscription
      const updated = await this.getSubscriptionById(id);
      if (!updated) {
        throw new StorageError(`Failed to retrieve updated subscription: ${id}`, {
          operation: 'updateSubscription',
          subscriptionId: id,
        });
      }

      return updated;
    } catch (error) {
      // Re-throw StorageError as-is
      if (error instanceof StorageError) {
        throw error;
      }
      
      throw new StorageError(
        `Failed to update subscription: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'updateSubscription',
          subscriptionId: id,
          updates,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  async deleteSubscription(id: string): Promise<void> {
    this.ensureNotClosed();

    try {
      const stmt = this.db.prepare(`
        DELETE FROM subscriptions WHERE id = ?
      `);

      stmt.run(id);
    } catch (error) {
      throw new StorageError(
        `Failed to delete subscription: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'deleteSubscription',
          subscriptionId: id,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  // Retry queue management methods

  async enqueueRetry(retry: RetryEntry): Promise<void> {
    this.ensureNotClosed();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO retry_queue (
          id, subscription_id, payload, attempt, next_retry_at, last_error, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        retry.id,
        retry.subscriptionId,
        JSON.stringify(retry.payload),
        retry.attempt,
        retry.nextRetryAt.getTime(),
        retry.lastError ?? null,
        retry.createdAt.getTime()
      );
    } catch (error) {
      throw new StorageError(
        `Failed to enqueue retry: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'enqueueRetry',
          retryId: retry.id,
          subscriptionId: retry.subscriptionId,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  async dequeueRetry(limit: number): Promise<RetryEntry[]> {
    this.ensureNotClosed();

    try {
      const now = Date.now();

      const stmt = this.db.prepare(`
        SELECT * FROM retry_queue
        WHERE next_retry_at <= ?
        ORDER BY next_retry_at ASC
        LIMIT ?
      `);

      const rows = stmt.all(now, limit) as any[];

      return rows.map((row) => this.rowToRetryEntry(row));
    } catch (error) {
      throw new StorageError(
        `Failed to dequeue retry: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'dequeueRetry',
          limit,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  async ackRetry(retryId: string): Promise<void> {
    this.ensureNotClosed();

    try {
      const stmt = this.db.prepare(`
        DELETE FROM retry_queue WHERE id = ?
      `);

      stmt.run(retryId);
    } catch (error) {
      throw new StorageError(
        `Failed to acknowledge retry: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'ackRetry',
          retryId,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  async getQueueStats(): Promise<QueueStats> {
    this.ensureNotClosed();

    try {
      const now = Date.now();

      // Count pending entries (nextRetryAt <= now)
      const pendingStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM retry_queue WHERE next_retry_at <= ?
      `);
      const pendingRow = pendingStmt.get(now) as any;
      const pending = pendingRow.count;

      // Count processing entries (nextRetryAt > now but not too far in the future)
      // For simplicity, we'll consider all future entries as "pending" in SQLite
      // since we don't track processing state separately
      const processing = 0;

      // Count failed entries - in this implementation, we don't track permanently failed
      // entries in the queue (they're removed after max retries), so this is 0
      const failed = 0;

      return {
        pending,
        processing,
        failed,
      };
    } catch (error) {
      throw new StorageError(
        `Failed to get queue stats: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'getQueueStats',
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  // Lifecycle methods

  async close(): Promise<void> {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }

  // Helper methods

  private ensureNotClosed(): void {
    if (this.closed) {
      throw new StorageError('Database connection is closed', {
        operation: 'ensureNotClosed',
      });
    }
  }

  private rowToSubscription(row: any): Subscription {
    return {
      id: row.id,
      endpoint: row.endpoint,
      keys: JSON.parse(row.keys),
      userId: row.user_id ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      failedCount: row.failed_count,
      status: row.status,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  private rowToRetryEntry(row: any): RetryEntry {
    return {
      id: row.id,
      subscriptionId: row.subscription_id,
      payload: JSON.parse(row.payload),
      attempt: row.attempt,
      nextRetryAt: new Date(row.next_retry_at),
      lastError: row.last_error ?? undefined,
      createdAt: new Date(row.created_at),
    };
  }
}

// Export version
export const version = '1.0.0';
