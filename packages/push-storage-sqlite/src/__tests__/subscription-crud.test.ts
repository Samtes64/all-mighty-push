/**
 * Tests for subscription CRUD operations
 */

import { SQLiteStorageAdapter } from '../index';
import { StorageError } from '@allmightypush/push-core';
import { randomUUID } from 'crypto';

describe('Subscription CRUD Operations', () => {
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

  describe('createSubscription', () => {
    it('should create a subscription with all required fields', async () => {
      const data = {
        endpoint: 'https://push.example.com/test',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
        userId: 'user-123',
        metadata: { device: 'mobile', browser: 'chrome' },
      };

      const subscription = await adapter.createSubscription(data);

      // Verify all required fields are present
      expect(subscription.id).toBeDefined();
      expect(subscription.endpoint).toBe(data.endpoint);
      expect(subscription.keys).toEqual(data.keys);
      expect(subscription.userId).toBe(data.userId);
      expect(subscription.createdAt).toBeInstanceOf(Date);
      expect(subscription.updatedAt).toBeInstanceOf(Date);
      expect(subscription.failedCount).toBe(0);
      expect(subscription.status).toBe('active');
      expect(subscription.metadata).toEqual(data.metadata);

      // Verify UUID format (v4)
      expect(subscription.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should create a subscription without optional fields', async () => {
      const data = {
        endpoint: 'https://push.example.com/test',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      };

      const subscription = await adapter.createSubscription(data);

      expect(subscription.id).toBeDefined();
      expect(subscription.endpoint).toBe(data.endpoint);
      expect(subscription.keys).toEqual(data.keys);
      expect(subscription.userId).toBeUndefined();
      expect(subscription.metadata).toBeUndefined();
      expect(subscription.expiresAt).toBeUndefined();
      expect(subscription.lastUsedAt).toBeUndefined();
    });

    it('should generate unique UUIDs for each subscription', async () => {
      const data = {
        endpoint: 'https://push.example.com/test',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      };

      const sub1 = await adapter.createSubscription(data);
      const sub2 = await adapter.createSubscription(data);
      const sub3 = await adapter.createSubscription(data);

      expect(sub1.id).not.toBe(sub2.id);
      expect(sub2.id).not.toBe(sub3.id);
      expect(sub1.id).not.toBe(sub3.id);
    });

    it('should wrap database errors with StorageError', async () => {
      // Close the database to trigger an error
      await adapter.close();

      const data = {
        endpoint: 'https://push.example.com/test',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      };

      await expect(adapter.createSubscription(data)).rejects.toThrow(StorageError);
      await expect(adapter.createSubscription(data)).rejects.toThrow(
        'Database connection is closed'
      );
    });
  });

  describe('getSubscriptionById', () => {
    it('should retrieve an existing subscription by id', async () => {
      const data = {
        endpoint: 'https://push.example.com/test',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
        userId: 'user-123',
        metadata: { device: 'mobile' },
      };

      const created = await adapter.createSubscription(data);
      const retrieved = await adapter.getSubscriptionById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.endpoint).toBe(created.endpoint);
      expect(retrieved!.keys).toEqual(created.keys);
      expect(retrieved!.userId).toBe(created.userId);
      expect(retrieved!.metadata).toEqual(created.metadata);
    });

    it('should return null for non-existent subscription', async () => {
      const nonExistentId = randomUUID();
      const result = await adapter.getSubscriptionById(nonExistentId);

      expect(result).toBeNull();
    });

    it('should wrap database errors with StorageError', async () => {
      await adapter.close();

      await expect(adapter.getSubscriptionById('some-id')).rejects.toThrow(StorageError);
    });
  });

  describe('findSubscriptions', () => {
    beforeEach(async () => {
      // Create test subscriptions
      await adapter.createSubscription({
        endpoint: 'https://push.example.com/user1-sub1',
        keys: { p256dh: 'key1', auth: 'auth1' },
        userId: 'user-1',
      });

      await adapter.createSubscription({
        endpoint: 'https://push.example.com/user1-sub2',
        keys: { p256dh: 'key2', auth: 'auth2' },
        userId: 'user-1',
      });

      await adapter.createSubscription({
        endpoint: 'https://push.example.com/user2-sub1',
        keys: { p256dh: 'key3', auth: 'auth3' },
        userId: 'user-2',
      });

      const sub4 = await adapter.createSubscription({
        endpoint: 'https://push.example.com/user2-sub2',
        keys: { p256dh: 'key4', auth: 'auth4' },
        userId: 'user-2',
      });

      // Update one subscription to blocked status
      await adapter.updateSubscription(sub4.id, { status: 'blocked' });
    });

    it('should find subscriptions by userId', async () => {
      const user1Subs = await adapter.findSubscriptions({ userId: 'user-1' });
      expect(user1Subs).toHaveLength(2);
      expect(user1Subs.every((sub) => sub.userId === 'user-1')).toBe(true);

      const user2Subs = await adapter.findSubscriptions({ userId: 'user-2' });
      expect(user2Subs).toHaveLength(2);
      expect(user2Subs.every((sub) => sub.userId === 'user-2')).toBe(true);
    });

    it('should find subscriptions by status', async () => {
      const activeSubs = await adapter.findSubscriptions({ status: 'active' });
      expect(activeSubs).toHaveLength(3);
      expect(activeSubs.every((sub) => sub.status === 'active')).toBe(true);

      const blockedSubs = await adapter.findSubscriptions({ status: 'blocked' });
      expect(blockedSubs).toHaveLength(1);
      expect(blockedSubs[0].status).toBe('blocked');
    });

    it('should find subscriptions by userId and status', async () => {
      const user2ActiveSubs = await adapter.findSubscriptions({
        userId: 'user-2',
        status: 'active',
      });
      expect(user2ActiveSubs).toHaveLength(1);
      expect(user2ActiveSubs[0].userId).toBe('user-2');
      expect(user2ActiveSubs[0].status).toBe('active');

      const user2BlockedSubs = await adapter.findSubscriptions({
        userId: 'user-2',
        status: 'blocked',
      });
      expect(user2BlockedSubs).toHaveLength(1);
      expect(user2BlockedSubs[0].userId).toBe('user-2');
      expect(user2BlockedSubs[0].status).toBe('blocked');
    });

    it('should find subscriptions by ids array', async () => {
      const allSubs = await adapter.findSubscriptions({});
      const ids = [allSubs[0].id, allSubs[2].id];

      const foundSubs = await adapter.findSubscriptions({ ids });
      expect(foundSubs).toHaveLength(2);
      expect(foundSubs.map((s) => s.id).sort()).toEqual(ids.sort());
    });

    it('should return all subscriptions when no filter is provided', async () => {
      const allSubs = await adapter.findSubscriptions({});
      expect(allSubs).toHaveLength(4);
    });

    it('should return empty array when no subscriptions match filter', async () => {
      const result = await adapter.findSubscriptions({ userId: 'non-existent-user' });
      expect(result).toEqual([]);
    });

    it('should wrap database errors with StorageError', async () => {
      await adapter.close();

      await expect(adapter.findSubscriptions({})).rejects.toThrow(StorageError);
    });
  });

  describe('updateSubscription', () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const sub = await adapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'key', auth: 'auth' },
        userId: 'user-1',
        metadata: { device: 'mobile' },
      });
      subscriptionId = sub.id;
    });

    it('should update subscription endpoint', async () => {
      const newEndpoint = 'https://push.example.com/new-endpoint';
      const updated = await adapter.updateSubscription(subscriptionId, {
        endpoint: newEndpoint,
      });

      expect(updated.endpoint).toBe(newEndpoint);
      expect(updated.id).toBe(subscriptionId);
    });

    it('should update subscription status', async () => {
      const updated = await adapter.updateSubscription(subscriptionId, {
        status: 'blocked',
      });

      expect(updated.status).toBe('blocked');
    });

    it('should update subscription failedCount', async () => {
      const updated = await adapter.updateSubscription(subscriptionId, {
        failedCount: 5,
      });

      expect(updated.failedCount).toBe(5);
    });

    it('should update subscription lastUsedAt', async () => {
      const lastUsedAt = new Date();
      const updated = await adapter.updateSubscription(subscriptionId, {
        lastUsedAt,
      });

      expect(updated.lastUsedAt).toEqual(lastUsedAt);
    });

    it('should update subscription metadata', async () => {
      const newMetadata = { device: 'desktop', browser: 'firefox' };
      const updated = await adapter.updateSubscription(subscriptionId, {
        metadata: newMetadata,
      });

      expect(updated.metadata).toEqual(newMetadata);
    });

    it('should update multiple fields at once', async () => {
      const updates = {
        status: 'expired' as const,
        failedCount: 10,
        lastUsedAt: new Date(),
        metadata: { reason: 'too many failures' },
      };

      const updated = await adapter.updateSubscription(subscriptionId, updates);

      expect(updated.status).toBe(updates.status);
      expect(updated.failedCount).toBe(updates.failedCount);
      expect(updated.lastUsedAt).toEqual(updates.lastUsedAt);
      expect(updated.metadata).toEqual(updates.metadata);
    });

    it('should update updatedAt timestamp', async () => {
      const original = await adapter.getSubscriptionById(subscriptionId);
      
      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await adapter.updateSubscription(subscriptionId, {
        failedCount: 1,
      });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(original!.updatedAt.getTime());
    });

    it('should throw StorageError for non-existent subscription', async () => {
      const nonExistentId = randomUUID();

      await expect(
        adapter.updateSubscription(nonExistentId, { status: 'blocked' })
      ).rejects.toThrow(StorageError);

      await expect(
        adapter.updateSubscription(nonExistentId, { status: 'blocked' })
      ).rejects.toThrow(`Subscription not found: ${nonExistentId}`);
    });

    it('should wrap database errors with StorageError', async () => {
      await adapter.close();

      await expect(
        adapter.updateSubscription(subscriptionId, { status: 'blocked' })
      ).rejects.toThrow(StorageError);
    });
  });

  describe('deleteSubscription', () => {
    it('should delete an existing subscription', async () => {
      const sub = await adapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      await adapter.deleteSubscription(sub.id);

      const retrieved = await adapter.getSubscriptionById(sub.id);
      expect(retrieved).toBeNull();
    });

    it('should not throw error when deleting non-existent subscription', async () => {
      const nonExistentId = randomUUID();

      await expect(adapter.deleteSubscription(nonExistentId)).resolves.toBeUndefined();
    });

    it('should cascade delete retry queue entries', async () => {
      const sub = await adapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      // Enqueue a retry entry
      await adapter.enqueueRetry({
        id: randomUUID(),
        subscriptionId: sub.id,
        payload: { title: 'Test', body: 'Body' },
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      });

      // Verify retry entry exists
      let retries = await adapter.dequeueRetry(10);
      expect(retries).toHaveLength(1);

      // Delete subscription
      await adapter.deleteSubscription(sub.id);

      // Verify retry entry was cascade deleted
      retries = await adapter.dequeueRetry(10);
      expect(retries).toHaveLength(0);
    });

    it('should wrap database errors with StorageError', async () => {
      await adapter.close();

      await expect(adapter.deleteSubscription('some-id')).rejects.toThrow(StorageError);
    });
  });

  describe('Error handling', () => {
    it('should include operation name in StorageError details', async () => {
      await adapter.close();

      try {
        await adapter.createSubscription({
          endpoint: 'https://push.example.com/test',
          keys: { p256dh: 'key', auth: 'auth' },
        });
        fail('Should have thrown StorageError');
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).details?.operation).toBe('ensureNotClosed');
      }
    });

    it('should include original error message in StorageError details', async () => {
      // Create a subscription first
      const sub = await adapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      // Close the database
      await adapter.close();

      try {
        await adapter.updateSubscription(sub.id, { status: 'blocked' });
        fail('Should have thrown StorageError');
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).message).toContain('Database connection is closed');
      }
    });
  });
});
