/**
 * Tests for retry queue operations
 */

import { SQLiteStorageAdapter } from '../index';
import { StorageError } from '@allmightypush/push-core';
import { randomUUID } from 'crypto';

describe('Retry Queue Operations', () => {
  let adapter: SQLiteStorageAdapter;
  let subscriptionId: string;

  beforeEach(async () => {
    // Use in-memory database for tests
    adapter = new SQLiteStorageAdapter({
      filename: ':memory:',
      autoMigrate: true,
    });

    // Create a test subscription for retry entries
    const subscription = await adapter.createSubscription({
      endpoint: 'https://push.example.com/test',
      keys: {
        p256dh: 'test-p256dh-key',
        auth: 'test-auth-key',
      },
      userId: 'test-user',
    });
    subscriptionId = subscription.id;
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('enqueueRetry', () => {
    it('should enqueue a retry entry with all required fields', async () => {
      const retryEntry = {
        id: randomUUID(),
        subscriptionId,
        payload: {
          title: 'Test Notification',
          body: 'This is a test notification',
          icon: 'https://example.com/icon.png',
        },
        attempt: 0,
        nextRetryAt: new Date(Date.now() + 5000),
        createdAt: new Date(),
      };

      await adapter.enqueueRetry(retryEntry);

      // Verify the entry was enqueued by dequeuing it
      const dequeued = await adapter.dequeueRetry(10);
      expect(dequeued).toHaveLength(0); // Should be 0 because nextRetryAt is in the future

      // Enqueue with past nextRetryAt to verify it can be dequeued
      const pastRetryEntry = {
        ...retryEntry,
        id: randomUUID(),
        nextRetryAt: new Date(Date.now() - 1000),
      };

      await adapter.enqueueRetry(pastRetryEntry);

      const dequeuedPast = await adapter.dequeueRetry(10);
      expect(dequeuedPast).toHaveLength(1);
      expect(dequeuedPast[0].id).toBe(pastRetryEntry.id);
      expect(dequeuedPast[0].subscriptionId).toBe(subscriptionId);
      expect(dequeuedPast[0].payload).toEqual(pastRetryEntry.payload);
      expect(dequeuedPast[0].attempt).toBe(0);
    });

    it('should enqueue retry entry with lastError', async () => {
      const retryEntry = {
        id: randomUUID(),
        subscriptionId,
        payload: {
          title: 'Test',
          body: 'Body',
        },
        attempt: 1,
        nextRetryAt: new Date(Date.now() - 1000),
        lastError: 'Network timeout',
        createdAt: new Date(),
      };

      await adapter.enqueueRetry(retryEntry);

      const dequeued = await adapter.dequeueRetry(10);
      expect(dequeued).toHaveLength(1);
      expect(dequeued[0].lastError).toBe('Network timeout');
    });

    it('should enqueue retry entry without lastError', async () => {
      const retryEntry = {
        id: randomUUID(),
        subscriptionId,
        payload: {
          title: 'Test',
          body: 'Body',
        },
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      };

      await adapter.enqueueRetry(retryEntry);

      const dequeued = await adapter.dequeueRetry(10);
      expect(dequeued).toHaveLength(1);
      expect(dequeued[0].lastError).toBeUndefined();
    });

    it('should enqueue multiple retry entries', async () => {
      const entries = [
        {
          id: randomUUID(),
          subscriptionId,
          payload: { title: 'Test 1', body: 'Body 1' },
          attempt: 0,
          nextRetryAt: new Date(Date.now() - 3000),
          createdAt: new Date(),
        },
        {
          id: randomUUID(),
          subscriptionId,
          payload: { title: 'Test 2', body: 'Body 2' },
          attempt: 1,
          nextRetryAt: new Date(Date.now() - 2000),
          createdAt: new Date(),
        },
        {
          id: randomUUID(),
          subscriptionId,
          payload: { title: 'Test 3', body: 'Body 3' },
          attempt: 2,
          nextRetryAt: new Date(Date.now() - 1000),
          createdAt: new Date(),
        },
      ];

      for (const entry of entries) {
        await adapter.enqueueRetry(entry);
      }

      const dequeued = await adapter.dequeueRetry(10);
      expect(dequeued).toHaveLength(3);
    });

    it('should wrap database errors with StorageError', async () => {
      await adapter.close();

      const retryEntry = {
        id: randomUUID(),
        subscriptionId,
        payload: { title: 'Test', body: 'Body' },
        attempt: 0,
        nextRetryAt: new Date(),
        createdAt: new Date(),
      };

      await expect(adapter.enqueueRetry(retryEntry)).rejects.toThrow(StorageError);
      await expect(adapter.enqueueRetry(retryEntry)).rejects.toThrow(
        'Database connection is closed'
      );
    });
  });

  describe('dequeueRetry', () => {
    it('should dequeue retry entries with nextRetryAt in the past', async () => {
      const pastEntry = {
        id: randomUUID(),
        subscriptionId,
        payload: { title: 'Past', body: 'Body' },
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 5000),
        createdAt: new Date(),
      };

      const futureEntry = {
        id: randomUUID(),
        subscriptionId,
        payload: { title: 'Future', body: 'Body' },
        attempt: 0,
        nextRetryAt: new Date(Date.now() + 5000),
        createdAt: new Date(),
      };

      await adapter.enqueueRetry(pastEntry);
      await adapter.enqueueRetry(futureEntry);

      const dequeued = await adapter.dequeueRetry(10);

      expect(dequeued).toHaveLength(1);
      expect(dequeued[0].id).toBe(pastEntry.id);
      expect(dequeued[0].payload.title).toBe('Past');
    });

    it('should respect the limit parameter', async () => {
      // Enqueue 5 entries
      for (let i = 0; i < 5; i++) {
        await adapter.enqueueRetry({
          id: randomUUID(),
          subscriptionId,
          payload: { title: `Test ${i}`, body: 'Body' },
          attempt: 0,
          nextRetryAt: new Date(Date.now() - 1000),
          createdAt: new Date(),
        });
      }

      // Dequeue with limit of 3
      const dequeued = await adapter.dequeueRetry(3);
      expect(dequeued).toHaveLength(3);

      // Verify remaining entries still exist
      const remaining = await adapter.dequeueRetry(10);
      expect(remaining).toHaveLength(5); // All 5 still exist (dequeue doesn't remove)
    });

    it('should order by nextRetryAt ascending', async () => {
      const entries = [
        {
          id: randomUUID(),
          subscriptionId,
          payload: { title: 'Third', body: 'Body' },
          attempt: 0,
          nextRetryAt: new Date(Date.now() - 1000),
          createdAt: new Date(),
        },
        {
          id: randomUUID(),
          subscriptionId,
          payload: { title: 'First', body: 'Body' },
          attempt: 0,
          nextRetryAt: new Date(Date.now() - 5000),
          createdAt: new Date(),
        },
        {
          id: randomUUID(),
          subscriptionId,
          payload: { title: 'Second', body: 'Body' },
          attempt: 0,
          nextRetryAt: new Date(Date.now() - 3000),
          createdAt: new Date(),
        },
      ];

      for (const entry of entries) {
        await adapter.enqueueRetry(entry);
      }

      const dequeued = await adapter.dequeueRetry(10);

      expect(dequeued).toHaveLength(3);
      expect(dequeued[0].payload.title).toBe('First');
      expect(dequeued[1].payload.title).toBe('Second');
      expect(dequeued[2].payload.title).toBe('Third');
    });

    it('should return empty array when no entries are ready', async () => {
      // Enqueue entries with future nextRetryAt
      await adapter.enqueueRetry({
        id: randomUUID(),
        subscriptionId,
        payload: { title: 'Future', body: 'Body' },
        attempt: 0,
        nextRetryAt: new Date(Date.now() + 10000),
        createdAt: new Date(),
      });

      const dequeued = await adapter.dequeueRetry(10);
      expect(dequeued).toEqual([]);
    });

    it('should return empty array when queue is empty', async () => {
      const dequeued = await adapter.dequeueRetry(10);
      expect(dequeued).toEqual([]);
    });

    it('should preserve all retry entry fields', async () => {
      const entry = {
        id: randomUUID(),
        subscriptionId,
        payload: {
          title: 'Test Notification',
          body: 'Test body',
          icon: 'https://example.com/icon.png',
          data: { customField: 'value' },
        },
        attempt: 3,
        nextRetryAt: new Date(Date.now() - 1000),
        lastError: 'Previous error message',
        createdAt: new Date(),
      };

      await adapter.enqueueRetry(entry);

      const dequeued = await adapter.dequeueRetry(10);

      expect(dequeued).toHaveLength(1);
      expect(dequeued[0].id).toBe(entry.id);
      expect(dequeued[0].subscriptionId).toBe(entry.subscriptionId);
      expect(dequeued[0].payload).toEqual(entry.payload);
      expect(dequeued[0].attempt).toBe(entry.attempt);
      expect(dequeued[0].lastError).toBe(entry.lastError);
      expect(dequeued[0].nextRetryAt).toBeInstanceOf(Date);
      expect(dequeued[0].createdAt).toBeInstanceOf(Date);
    });

    it('should wrap database errors with StorageError', async () => {
      await adapter.close();

      await expect(adapter.dequeueRetry(10)).rejects.toThrow(StorageError);
      await expect(adapter.dequeueRetry(10)).rejects.toThrow(
        'Database connection is closed'
      );
    });
  });

  describe('ackRetry', () => {
    it('should remove retry entry from queue', async () => {
      const entry = {
        id: randomUUID(),
        subscriptionId,
        payload: { title: 'Test', body: 'Body' },
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      };

      await adapter.enqueueRetry(entry);

      // Verify entry exists
      let dequeued = await adapter.dequeueRetry(10);
      expect(dequeued).toHaveLength(1);

      // Acknowledge the entry
      await adapter.ackRetry(entry.id);

      // Verify entry is removed
      dequeued = await adapter.dequeueRetry(10);
      expect(dequeued).toHaveLength(0);
    });

    it('should only remove the specified retry entry', async () => {
      const entry1 = {
        id: randomUUID(),
        subscriptionId,
        payload: { title: 'Test 1', body: 'Body' },
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      };

      const entry2 = {
        id: randomUUID(),
        subscriptionId,
        payload: { title: 'Test 2', body: 'Body' },
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      };

      await adapter.enqueueRetry(entry1);
      await adapter.enqueueRetry(entry2);

      // Acknowledge only entry1
      await adapter.ackRetry(entry1.id);

      // Verify only entry2 remains
      const dequeued = await adapter.dequeueRetry(10);
      expect(dequeued).toHaveLength(1);
      expect(dequeued[0].id).toBe(entry2.id);
    });

    it('should not throw error when acknowledging non-existent entry', async () => {
      const nonExistentId = randomUUID();

      await expect(adapter.ackRetry(nonExistentId)).resolves.toBeUndefined();
    });

    it('should wrap database errors with StorageError', async () => {
      await adapter.close();

      await expect(adapter.ackRetry('some-id')).rejects.toThrow(StorageError);
      await expect(adapter.ackRetry('some-id')).rejects.toThrow(
        'Database connection is closed'
      );
    });
  });

  describe('getQueueStats', () => {
    it('should return zero stats for empty queue', async () => {
      const stats = await adapter.getQueueStats();

      expect(stats.pending).toBe(0);
      expect(stats.processing).toBe(0);
      expect(stats.failed).toBe(0);
    });

    it('should count pending entries correctly', async () => {
      // Enqueue 3 entries with past nextRetryAt (pending)
      for (let i = 0; i < 3; i++) {
        await adapter.enqueueRetry({
          id: randomUUID(),
          subscriptionId,
          payload: { title: `Test ${i}`, body: 'Body' },
          attempt: 0,
          nextRetryAt: new Date(Date.now() - 1000),
          createdAt: new Date(),
        });
      }

      const stats = await adapter.getQueueStats();

      expect(stats.pending).toBe(3);
      expect(stats.processing).toBe(0);
      expect(stats.failed).toBe(0);
    });

    it('should not count future entries as pending', async () => {
      // Enqueue 2 past entries and 3 future entries
      for (let i = 0; i < 2; i++) {
        await adapter.enqueueRetry({
          id: randomUUID(),
          subscriptionId,
          payload: { title: `Past ${i}`, body: 'Body' },
          attempt: 0,
          nextRetryAt: new Date(Date.now() - 1000),
          createdAt: new Date(),
        });
      }

      for (let i = 0; i < 3; i++) {
        await adapter.enqueueRetry({
          id: randomUUID(),
          subscriptionId,
          payload: { title: `Future ${i}`, body: 'Body' },
          attempt: 0,
          nextRetryAt: new Date(Date.now() + 10000),
          createdAt: new Date(),
        });
      }

      const stats = await adapter.getQueueStats();

      expect(stats.pending).toBe(2);
    });

    it('should update stats after acknowledging entries', async () => {
      const entries = [];
      for (let i = 0; i < 3; i++) {
        const entry = {
          id: randomUUID(),
          subscriptionId,
          payload: { title: `Test ${i}`, body: 'Body' },
          attempt: 0,
          nextRetryAt: new Date(Date.now() - 1000),
          createdAt: new Date(),
        };
        entries.push(entry);
        await adapter.enqueueRetry(entry);
      }

      let stats = await adapter.getQueueStats();
      expect(stats.pending).toBe(3);

      // Acknowledge one entry
      await adapter.ackRetry(entries[0].id);

      stats = await adapter.getQueueStats();
      expect(stats.pending).toBe(2);

      // Acknowledge remaining entries
      await adapter.ackRetry(entries[1].id);
      await adapter.ackRetry(entries[2].id);

      stats = await adapter.getQueueStats();
      expect(stats.pending).toBe(0);
    });

    it('should wrap database errors with StorageError', async () => {
      await adapter.close();

      await expect(adapter.getQueueStats()).rejects.toThrow(StorageError);
      await expect(adapter.getQueueStats()).rejects.toThrow(
        'Database connection is closed'
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete retry workflow', async () => {
      // 1. Enqueue a retry
      const retryId = randomUUID();
      await adapter.enqueueRetry({
        id: retryId,
        subscriptionId,
        payload: { title: 'Test', body: 'Body' },
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      });

      // 2. Check stats
      let stats = await adapter.getQueueStats();
      expect(stats.pending).toBe(1);

      // 3. Dequeue the retry
      const dequeued = await adapter.dequeueRetry(1);
      expect(dequeued).toHaveLength(1);
      expect(dequeued[0].id).toBe(retryId);

      // 4. Process and acknowledge
      await adapter.ackRetry(retryId);

      // 5. Verify queue is empty
      stats = await adapter.getQueueStats();
      expect(stats.pending).toBe(0);

      const remaining = await adapter.dequeueRetry(10);
      expect(remaining).toHaveLength(0);
    });

    it('should handle retry with increasing attempt numbers', async () => {
      const baseRetry = {
        id: randomUUID(),
        subscriptionId,
        payload: { title: 'Test', body: 'Body' },
        createdAt: new Date(),
      };

      // Attempt 0
      await adapter.enqueueRetry({
        ...baseRetry,
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 1000),
      });

      let dequeued = await adapter.dequeueRetry(1);
      expect(dequeued[0].attempt).toBe(0);
      await adapter.ackRetry(baseRetry.id);

      // Attempt 1 (re-enqueue with same id but incremented attempt)
      const retry1Id = randomUUID();
      await adapter.enqueueRetry({
        ...baseRetry,
        id: retry1Id,
        attempt: 1,
        nextRetryAt: new Date(Date.now() - 1000),
        lastError: 'First failure',
      });

      dequeued = await adapter.dequeueRetry(1);
      expect(dequeued[0].attempt).toBe(1);
      expect(dequeued[0].lastError).toBe('First failure');
      await adapter.ackRetry(retry1Id);

      // Attempt 2
      const retry2Id = randomUUID();
      await adapter.enqueueRetry({
        ...baseRetry,
        id: retry2Id,
        attempt: 2,
        nextRetryAt: new Date(Date.now() - 1000),
        lastError: 'Second failure',
      });

      dequeued = await adapter.dequeueRetry(1);
      expect(dequeued[0].attempt).toBe(2);
      expect(dequeued[0].lastError).toBe('Second failure');
    });

    it('should handle multiple subscriptions with separate retry queues', async () => {
      // Create second subscription
      const sub2 = await adapter.createSubscription({
        endpoint: 'https://push.example.com/test2',
        keys: { p256dh: 'key2', auth: 'auth2' },
      });

      // Enqueue retries for both subscriptions
      await adapter.enqueueRetry({
        id: randomUUID(),
        subscriptionId: subscriptionId,
        payload: { title: 'Sub1', body: 'Body' },
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      });

      await adapter.enqueueRetry({
        id: randomUUID(),
        subscriptionId: sub2.id,
        payload: { title: 'Sub2', body: 'Body' },
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      });

      // Both should be dequeued
      const dequeued = await adapter.dequeueRetry(10);
      expect(dequeued).toHaveLength(2);

      const subscriptionIds = dequeued.map((r) => r.subscriptionId);
      expect(subscriptionIds).toContain(subscriptionId);
      expect(subscriptionIds).toContain(sub2.id);
    });
  });

  describe('Error handling', () => {
    it('should include operation name in StorageError details', async () => {
      await adapter.close();

      try {
        await adapter.enqueueRetry({
          id: randomUUID(),
          subscriptionId,
          payload: { title: 'Test', body: 'Body' },
          attempt: 0,
          nextRetryAt: new Date(),
          createdAt: new Date(),
        });
        throw new Error('Should have thrown StorageError');
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).details?.operation).toBe('ensureNotClosed');
      }
    });

    it('should include retry details in StorageError for enqueue failures', async () => {
      const retryId = randomUUID();
      
      await adapter.close();

      try {
        await adapter.enqueueRetry({
          id: retryId,
          subscriptionId,
          payload: { title: 'Test', body: 'Body' },
          attempt: 0,
          nextRetryAt: new Date(),
          createdAt: new Date(),
        });
        throw new Error('Should have thrown StorageError');
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        const storageError = error as StorageError;
        expect(storageError.message).toContain('Database connection is closed');
      }
    });
  });
});
