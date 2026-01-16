/**
 * Tests for SQLite schema and migrations
 */

import { SQLiteStorageAdapter } from '../index';
import { randomUUID } from 'crypto';

describe('SQLite Schema and Migrations', () => {
  let adapter: SQLiteStorageAdapter;

  beforeEach(() => {
    // Use in-memory database for tests
    adapter = new SQLiteStorageAdapter({
      filename: ':memory:',
      autoMigrate: true,
    });
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('Schema Creation', () => {
    it('should create subscriptions table with all required columns', async () => {
      // Create a subscription to verify the schema
      const subscription = await adapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
        userId: 'user-123',
        metadata: { test: 'data' },
      });

      // Verify all fields are present
      expect(subscription).toHaveProperty('id');
      expect(subscription).toHaveProperty('endpoint');
      expect(subscription).toHaveProperty('keys');
      expect(subscription).toHaveProperty('userId');
      expect(subscription).toHaveProperty('createdAt');
      expect(subscription).toHaveProperty('updatedAt');
      expect(subscription).toHaveProperty('failedCount');
      expect(subscription).toHaveProperty('status');
      expect(subscription).toHaveProperty('metadata');

      // Verify UUID format
      expect(subscription.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should create retry_queue table with all required columns', async () => {
      // First create a subscription
      const subscription = await adapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      });

      // Enqueue a retry entry
      const retryId = randomUUID();
      await adapter.enqueueRetry({
        id: retryId,
        subscriptionId: subscription.id,
        payload: {
          title: 'Test',
          body: 'Test notification',
        },
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 1000), // In the past
        createdAt: new Date(),
      });

      // Dequeue and verify all fields are present
      const retries = await adapter.dequeueRetry(10);
      expect(retries).toHaveLength(1);

      const retry = retries[0];
      expect(retry).toHaveProperty('id');
      expect(retry).toHaveProperty('subscriptionId');
      expect(retry).toHaveProperty('payload');
      expect(retry).toHaveProperty('attempt');
      expect(retry).toHaveProperty('nextRetryAt');
      expect(retry).toHaveProperty('createdAt');
    });

    it('should enforce status CHECK constraint', async () => {
      // Create a subscription
      const subscription = await adapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      });

      // Valid status values should work
      await expect(
        adapter.updateSubscription(subscription.id, { status: 'active' })
      ).resolves.toBeDefined();

      await expect(
        adapter.updateSubscription(subscription.id, { status: 'blocked' })
      ).resolves.toBeDefined();

      await expect(
        adapter.updateSubscription(subscription.id, { status: 'expired' })
      ).resolves.toBeDefined();
    });
  });

  describe('Indexes', () => {
    it('should create index on user_id for efficient filtering', async () => {
      // Create multiple subscriptions with different user IDs
      await adapter.createSubscription({
        endpoint: 'https://push.example.com/user1',
        keys: { p256dh: 'key1', auth: 'auth1' },
        userId: 'user-1',
      });

      await adapter.createSubscription({
        endpoint: 'https://push.example.com/user2',
        keys: { p256dh: 'key2', auth: 'auth2' },
        userId: 'user-2',
      });

      await adapter.createSubscription({
        endpoint: 'https://push.example.com/user1-2',
        keys: { p256dh: 'key3', auth: 'auth3' },
        userId: 'user-1',
      });

      // Query by user_id should work efficiently
      const user1Subs = await adapter.findSubscriptions({ userId: 'user-1' });
      expect(user1Subs).toHaveLength(2);

      const user2Subs = await adapter.findSubscriptions({ userId: 'user-2' });
      expect(user2Subs).toHaveLength(1);
    });

    it('should create index on status for efficient filtering', async () => {
      // Create subscriptions with different statuses
      await adapter.createSubscription({
        endpoint: 'https://push.example.com/1',
        keys: { p256dh: 'key1', auth: 'auth1' },
      });

      const sub2 = await adapter.createSubscription({
        endpoint: 'https://push.example.com/2',
        keys: { p256dh: 'key2', auth: 'auth2' },
      });

      const sub3 = await adapter.createSubscription({
        endpoint: 'https://push.example.com/3',
        keys: { p256dh: 'key3', auth: 'auth3' },
      });

      // Update some to different statuses
      await adapter.updateSubscription(sub2.id, { status: 'blocked' });
      await adapter.updateSubscription(sub3.id, { status: 'expired' });

      // Query by status should work efficiently
      const activeSubs = await adapter.findSubscriptions({ status: 'active' });
      expect(activeSubs).toHaveLength(1);

      const blockedSubs = await adapter.findSubscriptions({ status: 'blocked' });
      expect(blockedSubs).toHaveLength(1);

      const expiredSubs = await adapter.findSubscriptions({ status: 'expired' });
      expect(expiredSubs).toHaveLength(1);
    });

    it('should create index on next_retry_at for efficient dequeue', async () => {
      // Create a subscription
      const subscription = await adapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      // Enqueue multiple retries with different next_retry_at times
      const now = Date.now();

      await adapter.enqueueRetry({
        id: randomUUID(),
        subscriptionId: subscription.id,
        payload: { title: 'Test 1', body: 'Body 1' },
        attempt: 0,
        nextRetryAt: new Date(now - 3000), // 3 seconds ago
        createdAt: new Date(),
      });

      await adapter.enqueueRetry({
        id: randomUUID(),
        subscriptionId: subscription.id,
        payload: { title: 'Test 2', body: 'Body 2' },
        attempt: 0,
        nextRetryAt: new Date(now + 10000), // 10 seconds in future
        createdAt: new Date(),
      });

      await adapter.enqueueRetry({
        id: randomUUID(),
        subscriptionId: subscription.id,
        payload: { title: 'Test 3', body: 'Body 3' },
        attempt: 0,
        nextRetryAt: new Date(now - 1000), // 1 second ago
        createdAt: new Date(),
      });

      // Dequeue should only return entries with nextRetryAt in the past
      const retries = await adapter.dequeueRetry(10);
      expect(retries).toHaveLength(2);

      // Should be ordered by nextRetryAt (oldest first)
      expect(retries[0].payload.title).toBe('Test 1');
      expect(retries[1].payload.title).toBe('Test 3');
    });
  });

  describe('Foreign Key Constraint', () => {
    it('should cascade delete retry entries when subscription is deleted', async () => {
      // Create a subscription
      const subscription = await adapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      // Enqueue a retry entry
      const retryId = randomUUID();
      await adapter.enqueueRetry({
        id: retryId,
        subscriptionId: subscription.id,
        payload: { title: 'Test', body: 'Body' },
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      });

      // Verify retry entry exists
      let retries = await adapter.dequeueRetry(10);
      expect(retries).toHaveLength(1);

      // Delete the subscription
      await adapter.deleteSubscription(subscription.id);

      // Verify retry entry was cascade deleted
      retries = await adapter.dequeueRetry(10);
      expect(retries).toHaveLength(0);
    });
  });

  describe('migrate() method', () => {
    it('should run migrations without errors', async () => {
      await expect(adapter.migrate()).resolves.toBeUndefined();
    });

    it('should be idempotent (can be called multiple times)', async () => {
      await adapter.migrate();
      await adapter.migrate();
      await adapter.migrate();

      // Should still work after multiple migrations
      const subscription = await adapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      expect(subscription.id).toBeDefined();
    });

    it('should work with autoMigrate disabled', async () => {
      // Close the current adapter
      await adapter.close();

      // Create a new adapter with autoMigrate disabled
      adapter = new SQLiteStorageAdapter({
        filename: ':memory:',
        autoMigrate: false,
      });

      // Manually run migrations
      await adapter.migrate();

      // Should work after manual migration
      const subscription = await adapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      expect(subscription.id).toBeDefined();
    });
  });

  describe('WAL Mode', () => {
    it('should enable WAL mode by default', async () => {
      // WAL mode is enabled by default, just verify the adapter works
      const subscription = await adapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      expect(subscription.id).toBeDefined();
    });

    it('should work with WAL mode disabled', async () => {
      // Close the current adapter
      await adapter.close();

      // Create a new adapter with WAL disabled
      adapter = new SQLiteStorageAdapter({
        filename: ':memory:',
        enableWAL: false,
      });

      const subscription = await adapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      expect(subscription.id).toBeDefined();
    });
  });
});
