/**
 * @allmightypush/push-storage-mongo
 * MongoDB storage adapter for push notification library
 */

import { MongoClient, Db, Collection, MongoClientOptions } from 'mongodb';
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
 * Configuration options for MongoDB storage adapter
 */
export interface MongoDBStorageOptions {
  /** MongoDB connection URI */
  uri: string;
  /** Database name */
  database: string;
  /** MongoDB client options */
  clientOptions?: MongoClientOptions;
  /** Whether to create indexes automatically on initialization (default: true) */
  autoCreateIndexes?: boolean;
}

/**
 * MongoDB storage adapter implementation
 */
export class MongoDBStorageAdapter implements StorageAdapter {
  private client: MongoClient;
  private db!: Db;
  private subscriptions!: Collection;
  private retryQueue!: Collection;
  private closed: boolean = false;
  private connected: boolean = false;

  constructor(private options: MongoDBStorageOptions) {
    this.client = new MongoClient(options.uri, options.clientOptions);
  }

  /**
   * Connect to MongoDB and initialize collections
   */
  private async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      await this.client.connect();
      this.db = this.client.db(this.options.database);
      this.subscriptions = this.db.collection('subscriptions');
      this.retryQueue = this.db.collection('retry_queue');
      this.connected = true;

      // Create indexes if enabled
      if (this.options.autoCreateIndexes !== false) {
        await this.createIndexes();
      }
    } catch (error: any) {
      throw new StorageError(`Failed to connect to MongoDB: ${error.message}`);
    }
  }

  /**
   * Create indexes for collections
   */
  private async createIndexes(): Promise<void> {
    try {
      // Subscriptions indexes
      await this.subscriptions.createIndex({ userId: 1 });
      await this.subscriptions.createIndex({ status: 1 });
      await this.subscriptions.createIndex({ endpoint: 1 }, { unique: true });

      // Retry queue indexes
      await this.retryQueue.createIndex({ nextRetryAt: 1 });
      await this.retryQueue.createIndex({ subscriptionId: 1 });
    } catch (error: any) {
      throw new StorageError(`Failed to create indexes: ${error.message}`);
    }
  }

  /**
   * Run database migrations (creates indexes)
   */
  async migrate(): Promise<void> {
    await this.connect();
    await this.createIndexes();
  }

  /**
   * Create a new subscription
   */
  async createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
    await this.connect();
    this.ensureNotClosed();

    try {
      const id = randomUUID();
      const now = new Date();

      const subscription: Subscription = {
        id,
        endpoint: data.endpoint,
        keys: data.keys,
        userId: data.userId,
        createdAt: now,
        updatedAt: now,
        failedCount: 0,
        status: 'active',
        expiresAt: data.expiresAt,
        metadata: data.metadata,
      };

      await this.subscriptions.insertOne(subscription as any);

      return subscription;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new StorageError('Subscription with this endpoint already exists');
      }
      throw new StorageError(`Failed to create subscription: ${error.message}`);
    }
  }

  /**
   * Retrieve a subscription by its ID
   */
  async getSubscriptionById(id: string): Promise<Subscription | null> {
    await this.connect();
    this.ensureNotClosed();

    try {
      const doc = await this.subscriptions.findOne({ id });

      if (!doc) {
        return null;
      }

      return this.docToSubscription(doc);
    } catch (error: any) {
      throw new StorageError(`Failed to get subscription: ${error.message}`);
    }
  }

  /**
   * Find subscriptions matching filter criteria
   */
  async findSubscriptions(filter: SubscriptionFilter): Promise<Subscription[]> {
    await this.connect();
    this.ensureNotClosed();

    try {
      const query: any = {};

      if (filter.userId) {
        query.userId = filter.userId;
      }

      if (filter.status) {
        query.status = filter.status;
      }

      if (filter.ids && filter.ids.length > 0) {
        query.id = { $in: filter.ids };
      }

      const docs = await this.subscriptions.find(query).toArray();

      return docs.map((doc) => this.docToSubscription(doc));
    } catch (error: any) {
      throw new StorageError(`Failed to find subscriptions: ${error.message}`);
    }
  }

  /**
   * Update a subscription
   */
  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    await this.connect();
    this.ensureNotClosed();

    try {
      const updateDoc: any = {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      };

      const result = await this.subscriptions.findOneAndUpdate(
        { id },
        updateDoc,
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new StorageError(`Subscription not found: ${id}`);
      }

      return this.docToSubscription(result);
    } catch (error: any) {
      throw new StorageError(`Failed to update subscription: ${error.message}`);
    }
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(id: string): Promise<void> {
    await this.connect();
    this.ensureNotClosed();

    try {
      await this.subscriptions.deleteOne({ id });
      // Also delete associated retry queue entries
      await this.retryQueue.deleteMany({ subscriptionId: id });
    } catch (error: any) {
      throw new StorageError(`Failed to delete subscription: ${error.message}`);
    }
  }

  /**
   * Add an entry to the retry queue
   */
  async enqueueRetry(retry: RetryEntry): Promise<void> {
    await this.connect();
    this.ensureNotClosed();

    try {
      const id = retry.id || randomUUID();

      await this.retryQueue.insertOne({
        id,
        subscriptionId: retry.subscriptionId,
        payload: retry.payload,
        attempt: retry.attempt,
        nextRetryAt: retry.nextRetryAt,
        lastError: retry.lastError,
        createdAt: new Date(),
      } as any);
    } catch (error: any) {
      throw new StorageError(`Failed to enqueue retry: ${error.message}`);
    }
  }

  /**
   * Retrieve entries from the retry queue that are ready to be processed
   */
  async dequeueRetry(limit: number): Promise<RetryEntry[]> {
    await this.connect();
    this.ensureNotClosed();

    try {
      const docs = await this.retryQueue
        .find({ nextRetryAt: { $lte: new Date() } })
        .sort({ nextRetryAt: 1 })
        .limit(limit)
        .toArray();

      return docs.map((doc) => this.docToRetryEntry(doc));
    } catch (error: any) {
      throw new StorageError(`Failed to dequeue retry: ${error.message}`);
    }
  }

  /**
   * Acknowledge that a retry entry has been processed
   */
  async ackRetry(retryId: string): Promise<void> {
    await this.connect();
    this.ensureNotClosed();

    try {
      await this.retryQueue.deleteOne({ id: retryId });
    } catch (error: any) {
      throw new StorageError(`Failed to acknowledge retry: ${error.message}`);
    }
  }

  /**
   * Get statistics about the retry queue
   */
  async getQueueStats(): Promise<QueueStats> {
    await this.connect();
    this.ensureNotClosed();

    try {
      const pending = await this.retryQueue.countDocuments({
        nextRetryAt: { $lte: new Date() },
      });

      return {
        pending,
        processing: 0, // MongoDB doesn't track processing state
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
      await this.client.close();
      this.closed = true;
      this.connected = false;
    }
  }

  /**
   * Convert MongoDB document to Subscription object
   */
  private docToSubscription(doc: any): Subscription {
    return {
      id: doc.id,
      endpoint: doc.endpoint,
      keys: doc.keys,
      userId: doc.userId,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt),
      lastUsedAt: doc.lastUsedAt ? (doc.lastUsedAt instanceof Date ? doc.lastUsedAt : new Date(doc.lastUsedAt)) : undefined,
      failedCount: doc.failedCount,
      status: doc.status,
      expiresAt: doc.expiresAt ? (doc.expiresAt instanceof Date ? doc.expiresAt : new Date(doc.expiresAt)) : undefined,
      metadata: doc.metadata,
    };
  }

  /**
   * Convert MongoDB document to RetryEntry object
   */
  private docToRetryEntry(doc: any): RetryEntry {
    return {
      id: doc.id,
      subscriptionId: doc.subscriptionId,
      payload: doc.payload,
      attempt: doc.attempt,
      nextRetryAt: doc.nextRetryAt instanceof Date ? doc.nextRetryAt : new Date(doc.nextRetryAt),
      lastError: doc.lastError,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
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

export default MongoDBStorageAdapter;
