/**
 * @allmightypush/push-storage-postgres
 * PostgreSQL storage adapter for push notification library
 */

import { Pool, PoolConfig } from 'pg';
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
 * Configuration options for PostgreSQL storage adapter
 */
export interface PostgreSQLStorageOptions extends PoolConfig {
  /** Whether to run migrations automatically on initialization (default: true) */
  autoMigrate?: boolean;
}

/**
 * PostgreSQL storage adapter implementation
 */
export class PostgreSQLStorageAdapter implements StorageAdapter {
  private pool: Pool;
  private closed: boolean = false;

  constructor(options: PostgreSQLStorageOptions) {
    const { autoMigrate = true, ...poolConfig } = options;
    this.pool = new Pool(poolConfig);

    // Run migrations automatically if enabled
    if (autoMigrate) {
      this.migrate().catch((error) => {
        throw new StorageError(`Failed to run migrations: ${error.message}`);
      });
    }
  }

  /**
   * Run database migrations
   */
  async migrate(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Create subscriptions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id UUID PRIMARY KEY,
          endpoint TEXT NOT NULL,
          keys JSONB NOT NULL,
          user_id TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          last_used_at TIMESTAMP,
          failed_count INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL CHECK(status IN ('active', 'blocked', 'expired')),
          expires_at TIMESTAMP,
          metadata JSONB
        )
      `);

      // Create indexes for subscriptions table
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)
      `);

      // Create retry_queue table
      await client.query(`
        CREATE TABLE IF NOT EXISTS retry_queue (
          id UUID PRIMARY KEY,
          subscription_id UUID NOT NULL,
          payload JSONB NOT NULL,
          attempt INTEGER NOT NULL,
          next_retry_at TIMESTAMP NOT NULL,
          last_error TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
        )
      `);

      // Create index for retry_queue table
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_retry_queue_next_retry ON retry_queue(next_retry_at)
      `);
    } finally {
      client.release();
    }
  }

  /**
   * Create a new subscription
   */
  async createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
    this.ensureNotClosed();

    try {
      const id = randomUUID();
      const now = new Date();

      const result = await this.pool.query(
        `INSERT INTO subscriptions (id, endpoint, keys, user_id, created_at, updated_at, failed_count, status, expires_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          id,
          data.endpoint,
          JSON.stringify(data.keys),
          data.userId || null,
          now,
          now,
          0,
          'active',
          data.expiresAt || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );

      return this.rowToSubscription(result.rows[0]);
    } catch (error: any) {
      throw new StorageError(`Failed to create subscription: ${error.message}`);
    }
  }

  /**
   * Retrieve a subscription by its ID
   */
  async getSubscriptionById(id: string): Promise<Subscription | null> {
    this.ensureNotClosed();

    try {
      const result = await this.pool.query('SELECT * FROM subscriptions WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToSubscription(result.rows[0]);
    } catch (error: any) {
      throw new StorageError(`Failed to get subscription: ${error.message}`);
    }
  }

  /**
   * Find subscriptions matching filter criteria
   */
  async findSubscriptions(filter: SubscriptionFilter): Promise<Subscription[]> {
    this.ensureNotClosed();

    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (filter.userId) {
        conditions.push(`user_id = $${paramIndex++}`);
        params.push(filter.userId);
      }

      if (filter.status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filter.status);
      }

      if (filter.ids && filter.ids.length > 0) {
        conditions.push(`id = ANY($${paramIndex++})`);
        params.push(filter.ids);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT * FROM subscriptions ${whereClause}`;

      const result = await this.pool.query(query, params);

      return result.rows.map((row) => this.rowToSubscription(row));
    } catch (error: any) {
      throw new StorageError(`Failed to find subscriptions: ${error.message}`);
    }
  }

  /**
   * Update a subscription
   */
  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    this.ensureNotClosed();

    try {
      const fields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (updates.lastUsedAt !== undefined) {
        fields.push(`last_used_at = $${paramIndex++}`);
        params.push(updates.lastUsedAt);
      }

      if (updates.failedCount !== undefined) {
        fields.push(`failed_count = $${paramIndex++}`);
        params.push(updates.failedCount);
      }

      if (updates.status !== undefined) {
        fields.push(`status = $${paramIndex++}`);
        params.push(updates.status);
      }

      if (updates.metadata !== undefined) {
        fields.push(`metadata = $${paramIndex++}`);
        params.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
      }

      if (updates.expiresAt !== undefined) {
        fields.push(`expires_at = $${paramIndex++}`);
        params.push(updates.expiresAt);
      }

      // Always update updated_at
      fields.push(`updated_at = $${paramIndex++}`);
      params.push(new Date());

      // Add id as last parameter
      params.push(id);

      const query = `UPDATE subscriptions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

      const result = await this.pool.query(query, params);

      if (result.rows.length === 0) {
        throw new StorageError(`Subscription not found: ${id}`);
      }

      return this.rowToSubscription(result.rows[0]);
    } catch (error: any) {
      throw new StorageError(`Failed to update subscription: ${error.message}`);
    }
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(id: string): Promise<void> {
    this.ensureNotClosed();

    try {
      await this.pool.query('DELETE FROM subscriptions WHERE id = $1', [id]);
    } catch (error: any) {
      throw new StorageError(`Failed to delete subscription: ${error.message}`);
    }
  }

  /**
   * Add an entry to the retry queue
   */
  async enqueueRetry(retry: RetryEntry): Promise<void> {
    this.ensureNotClosed();

    try {
      const id = retry.id || randomUUID();

      await this.pool.query(
        `INSERT INTO retry_queue (id, subscription_id, payload, attempt, next_retry_at, last_error, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          retry.subscriptionId,
          JSON.stringify(retry.payload),
          retry.attempt,
          retry.nextRetryAt,
          retry.lastError || null,
          new Date(),
        ]
      );
    } catch (error: any) {
      throw new StorageError(`Failed to enqueue retry: ${error.message}`);
    }
  }

  /**
   * Retrieve entries from the retry queue that are ready to be processed
   */
  async dequeueRetry(limit: number): Promise<RetryEntry[]> {
    this.ensureNotClosed();

    try {
      const result = await this.pool.query(
        `SELECT * FROM retry_queue WHERE next_retry_at <= $1 ORDER BY next_retry_at ASC LIMIT $2`,
        [new Date(), limit]
      );

      return result.rows.map((row) => this.rowToRetryEntry(row));
    } catch (error: any) {
      throw new StorageError(`Failed to dequeue retry: ${error.message}`);
    }
  }

  /**
   * Acknowledge that a retry entry has been processed
   */
  async ackRetry(retryId: string): Promise<void> {
    this.ensureNotClosed();

    try {
      await this.pool.query('DELETE FROM retry_queue WHERE id = $1', [retryId]);
    } catch (error: any) {
      throw new StorageError(`Failed to acknowledge retry: ${error.message}`);
    }
  }

  /**
   * Get statistics about the retry queue
   */
  async getQueueStats(): Promise<QueueStats> {
    this.ensureNotClosed();

    try {
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN next_retry_at <= NOW() THEN 1 END) as pending
        FROM retry_queue
      `);

      const row = result.rows[0];

      return {
        pending: parseInt(row.pending, 10),
        processing: 0, // PostgreSQL doesn't track processing state
        failed: 0, // Failed entries are removed from queue
      };
    } catch (error: any) {
      throw new StorageError(`Failed to get queue stats: ${error.message}`);
    }
  }

  /**
   * Close all connections and clean up resources
   */
  async close(): Promise<void> {
    if (!this.closed) {
      await this.pool.end();
      this.closed = true;
    }
  }

  /**
   * Convert database row to Subscription object
   */
  private rowToSubscription(row: any): Subscription {
    return {
      id: row.id,
      endpoint: row.endpoint,
      keys: typeof row.keys === 'string' ? JSON.parse(row.keys) : row.keys,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      failedCount: row.failed_count,
      status: row.status,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
    };
  }

  /**
   * Convert database row to RetryEntry object
   */
  private rowToRetryEntry(row: any): RetryEntry {
    return {
      id: row.id,
      subscriptionId: row.subscription_id,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      attempt: row.attempt,
      nextRetryAt: new Date(row.next_retry_at),
      lastError: row.last_error,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Ensure the adapter is not closed
   */
  private ensureNotClosed(): void {
    if (this.closed) {
      throw new StorageError('Storage adapter is closed');
    }
  }
}

export default PostgreSQLStorageAdapter;
