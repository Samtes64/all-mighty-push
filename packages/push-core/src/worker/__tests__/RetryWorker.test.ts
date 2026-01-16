/**
 * Tests for RetryWorker class
 */

import { RetryWorker } from '../RetryWorker';
import type { StorageAdapter, ProviderAdapter } from '../../types/adapters';
import type { Subscription } from '../../types/subscription';
import type { NotificationPayload } from '../../types/notification';
import type { ProviderResult, RetryEntry, QueueStats } from '../../types/results';
import type { RetryPolicy } from '../../types/configuration';

// Mock storage adapter
class MockStorageAdapter implements StorageAdapter {
  subscriptions: Map<string, Subscription> = new Map();
  retryQueue: RetryEntry[] = [];
  dequeuedRetries: RetryEntry[] = [];
  ackedRetries: string[] = [];

  async createSubscription(data: any): Promise<Subscription> {
    const subscription: Subscription = {
      id: 'sub-' + Date.now(),
      failedCount: 0,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  async getSubscriptionById(id: string): Promise<Subscription | null> {
    return this.subscriptions.get(id) || null;
  }

  async findSubscriptions(): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values());
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    const existing = this.subscriptions.get(id);
    if (!existing) throw new Error('Subscription not found');
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.subscriptions.set(id, updated);
    return updated;
  }

  async deleteSubscription(id: string): Promise<void> {
    this.subscriptions.delete(id);
  }

  async enqueueRetry(retry: RetryEntry): Promise<void> {
    this.retryQueue.push(retry);
  }

  async dequeueRetry(limit: number): Promise<RetryEntry[]> {
    const now = new Date();
    const ready = this.retryQueue
      .filter(r => r.nextRetryAt <= now && !this.dequeuedRetries.find(d => d.id === r.id))
      .slice(0, limit);
    this.dequeuedRetries.push(...ready);
    return ready;
  }

  async ackRetry(retryId: string): Promise<void> {
    this.ackedRetries.push(retryId);
    this.retryQueue = this.retryQueue.filter(r => r.id !== retryId);
    this.dequeuedRetries = this.dequeuedRetries.filter(r => r.id !== retryId);
  }

  async getQueueStats(): Promise<QueueStats> {
    return {
      pending: this.retryQueue.length,
      processing: 0,
      failed: 0,
    };
  }

  async close(): Promise<void> {
    // No-op for mock
  }
}

// Mock provider adapter
class MockProviderAdapter implements ProviderAdapter {
  sendResults: ProviderResult[] = [];
  sendCalls: Array<{ subscription: Subscription; payload: NotificationPayload }> = [];

  constructor(private defaultResult: ProviderResult = { success: true, shouldRetry: false }) {}

  async send(subscription: Subscription, payload: NotificationPayload): Promise<ProviderResult> {
    this.sendCalls.push({ subscription, payload });
    return this.sendResults.shift() || this.defaultResult;
  }

  getName(): string {
    return 'mock-provider';
  }
}

describe('RetryWorker', () => {
  let worker: RetryWorker;
  let storageAdapter: MockStorageAdapter;
  let providerAdapter: MockProviderAdapter;
  let retryPolicy: RetryPolicy;

  beforeEach(() => {
    storageAdapter = new MockStorageAdapter();
    providerAdapter = new MockProviderAdapter();
    retryPolicy = {
      maxRetries: 3,
      baseDelay: 1000,
      backoffFactor: 2,
      maxDelay: 60000,
      jitter: false,
    };
  });

  afterEach(async () => {
    if (worker && worker.isRunning()) {
      await worker.stop();
    }
  });

  describe('start and stop', () => {
    it('should start the worker', async () => {
      worker = new RetryWorker(storageAdapter, providerAdapter, retryPolicy, {
        pollInterval: 100,
      });

      const startPromise = worker.start();
      
      // Give it time to start
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(worker.isRunning()).toBe(true);

      await worker.stop();
      await startPromise;
    });

    it('should stop the worker gracefully', async () => {
      worker = new RetryWorker(storageAdapter, providerAdapter, retryPolicy, {
        pollInterval: 100,
      });

      const startPromise = worker.start();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(worker.isRunning()).toBe(true);

      await worker.stop();
      expect(worker.isRunning()).toBe(false);

      await startPromise;
    });

    it('should throw if starting when already running', async () => {
      worker = new RetryWorker(storageAdapter, providerAdapter, retryPolicy, {
        pollInterval: 100,
      });

      const startPromise = worker.start();
      
      await new Promise(resolve => setTimeout(resolve, 50));

      await expect(worker.start()).rejects.toThrow('already running');

      await worker.stop();
      await startPromise;
    });

    it('should handle stop when not running', async () => {
      worker = new RetryWorker(storageAdapter, providerAdapter, retryPolicy);

      await expect(worker.stop()).resolves.toBeUndefined();
    });
  });

  describe('processRetry', () => {
    it('should process successful retry', async () => {
      const subscription = await storageAdapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
        failedCount: 2,
      });

      const retry: RetryEntry = {
        id: 'retry-1',
        subscriptionId: subscription.id,
        payload: { title: 'Test', body: 'Test notification' },
        attempt: 1,
        nextRetryAt: new Date(Date.now() - 1000), // In the past
        createdAt: new Date(),
      };

      storageAdapter.retryQueue.push(retry);

      worker = new RetryWorker(storageAdapter, providerAdapter, retryPolicy, {
        pollInterval: 100,
        batchSize: 10,
      });

      const startPromise = worker.start();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      await worker.stop();
      await startPromise;

      // Verify retry was acknowledged
      expect(storageAdapter.ackedRetries).toContain('retry-1');

      // Verify subscription was updated
      const updated = await storageAdapter.getSubscriptionById(subscription.id);
      expect(updated?.failedCount).toBe(0);
      expect(updated?.lastUsedAt).toBeDefined();

      // Verify provider was called
      expect(providerAdapter.sendCalls).toHaveLength(1);
    });

    it('should re-enqueue on retriable failure', async () => {
      providerAdapter.sendResults.push({
        success: false,
        statusCode: 500,
        shouldRetry: true,
      });

      const subscription = await storageAdapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });

      const retry: RetryEntry = {
        id: 'retry-1',
        subscriptionId: subscription.id,
        payload: { title: 'Test', body: 'Test notification' },
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      };

      storageAdapter.retryQueue.push(retry);

      // Track enqueue calls
      const originalEnqueue = storageAdapter.enqueueRetry.bind(storageAdapter);
      let enqueueCallCount = 0;
      storageAdapter.enqueueRetry = async (retry: RetryEntry) => {
        enqueueCallCount++;
        return originalEnqueue(retry);
      };

      worker = new RetryWorker(storageAdapter, providerAdapter, retryPolicy, {
        pollInterval: 100,
      });

      const startPromise = worker.start();

      await new Promise(resolve => setTimeout(resolve, 250));

      await worker.stop();
      await startPromise;

      // Original retry should be acknowledged
      expect(storageAdapter.ackedRetries).toContain('retry-1');

      // Provider should have been called
      expect(providerAdapter.sendCalls).toHaveLength(1);

      // Enqueue should have been called to re-enqueue
      expect(enqueueCallCount).toBe(1);
      
      // Original retry should have been acked
      expect(storageAdapter.ackedRetries).toContain('retry-1');
    });

    it('should mark subscription as expired after max retries', async () => {
      providerAdapter.sendResults.push({
        success: false,
        statusCode: 500,
        shouldRetry: true,
      });

      const subscription = await storageAdapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });

      const retry: RetryEntry = {
        id: 'retry-1',
        subscriptionId: subscription.id,
        payload: { title: 'Test', body: 'Test notification' },
        attempt: 3, // At max retries
        nextRetryAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      };

      storageAdapter.retryQueue.push(retry);

      worker = new RetryWorker(storageAdapter, providerAdapter, retryPolicy, {
        pollInterval: 100,
      });

      const startPromise = worker.start();

      await new Promise(resolve => setTimeout(resolve, 200));

      await worker.stop();
      await startPromise;

      // Verify subscription was marked as expired
      const updated = await storageAdapter.getSubscriptionById(subscription.id);
      expect(updated?.status).toBe('expired');

      // Verify retry was acknowledged
      expect(storageAdapter.ackedRetries).toContain('retry-1');

      // No new retry should be enqueued
      const newRetries = storageAdapter.retryQueue.filter(
        r => r.subscriptionId === subscription.id && r.id !== 'retry-1'
      );
      expect(newRetries).toHaveLength(0);
    });

    it('should handle missing subscription', async () => {
      const retry: RetryEntry = {
        id: 'retry-1',
        subscriptionId: 'non-existent',
        payload: { title: 'Test', body: 'Test notification' },
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      };

      storageAdapter.retryQueue.push(retry);

      worker = new RetryWorker(storageAdapter, providerAdapter, retryPolicy, {
        pollInterval: 100,
      });

      const startPromise = worker.start();

      await new Promise(resolve => setTimeout(resolve, 200));

      await worker.stop();
      await startPromise;

      // Retry should be acknowledged even though subscription doesn't exist
      expect(storageAdapter.ackedRetries).toContain('retry-1');

      // Provider should not be called
      expect(providerAdapter.sendCalls).toHaveLength(0);
    });
  });

  describe('concurrency control', () => {
    it('should respect concurrency limits', async () => {
      const subscription = await storageAdapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });

      // Add multiple retries
      for (let i = 0; i < 5; i++) {
        storageAdapter.retryQueue.push({
          id: `retry-${i}`,
          subscriptionId: subscription.id,
          payload: { title: 'Test', body: `Test ${i}` },
          attempt: 0,
          nextRetryAt: new Date(Date.now() - 1000),
          createdAt: new Date(),
        });
      }

      worker = new RetryWorker(storageAdapter, providerAdapter, retryPolicy, {
        pollInterval: 100,
        concurrency: 2,
        batchSize: 10,
      });

      const startPromise = worker.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      await worker.stop();
      await startPromise;

      // All retries should be processed
      expect(providerAdapter.sendCalls.length).toBeGreaterThanOrEqual(5);
    });

    it('should respect batch size', async () => {
      const subscription = await storageAdapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });

      // Add more retries than batch size
      for (let i = 0; i < 15; i++) {
        storageAdapter.retryQueue.push({
          id: `retry-${i}`,
          subscriptionId: subscription.id,
          payload: { title: 'Test', body: `Test ${i}` },
          attempt: 0,
          nextRetryAt: new Date(Date.now() - 1000),
          createdAt: new Date(),
        });
      }

      worker = new RetryWorker(storageAdapter, providerAdapter, retryPolicy, {
        pollInterval: 50,
        batchSize: 5,
      });

      const startPromise = worker.start();

      // Wait for multiple poll cycles
      await new Promise(resolve => setTimeout(resolve, 400));

      await worker.stop();
      await startPromise;

      // All retries should eventually be processed
      expect(providerAdapter.sendCalls.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe('polling behavior', () => {
    it('should poll at configured interval', async () => {
      worker = new RetryWorker(storageAdapter, providerAdapter, retryPolicy, {
        pollInterval: 100,
      });

      let pollCount = 0;
      const originalDequeue = storageAdapter.dequeueRetry.bind(storageAdapter);
      storageAdapter.dequeueRetry = async (limit: number) => {
        pollCount++;
        return originalDequeue(limit);
      };

      const startPromise = worker.start();

      await new Promise(resolve => setTimeout(resolve, 350));

      await worker.stop();
      await startPromise;

      // Should have polled at least 3 times in 350ms with 100ms interval
      expect(pollCount).toBeGreaterThanOrEqual(3);
    });

    it('should back off on errors', async () => {
      let errorCount = 0;
      storageAdapter.dequeueRetry = async () => {
        errorCount++;
        if (errorCount <= 2) {
          throw new Error('Storage error');
        }
        return [];
      };

      worker = new RetryWorker(storageAdapter, providerAdapter, retryPolicy, {
        pollInterval: 50,
        errorBackoff: 100,
      });

      const startPromise = worker.start();

      await new Promise(resolve => setTimeout(resolve, 400));

      await worker.stop();
      await startPromise;

      // Should have encountered errors and backed off
      expect(errorCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('graceful shutdown', () => {
    it('should wait for in-flight processing', async () => {
      const subscription = await storageAdapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });

      // Make provider slow
      let resolveProvider: () => void;
      const providerPromise = new Promise<ProviderResult>((resolve) => {
        resolveProvider = () => resolve({ success: true, shouldRetry: false });
      });

      const slowProvider: ProviderAdapter = {
        send: () => providerPromise,
        getName: () => 'slow-provider',
      };

      const retry: RetryEntry = {
        id: 'retry-1',
        subscriptionId: subscription.id,
        payload: { title: 'Test', body: 'Test notification' },
        attempt: 0,
        nextRetryAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      };

      storageAdapter.retryQueue.push(retry);

      worker = new RetryWorker(storageAdapter, slowProvider, retryPolicy, {
        pollInterval: 50,
      });

      const startPromise = worker.start();

      // Wait for retry to be picked up
      await new Promise(resolve => setTimeout(resolve, 100));

      // Start shutdown
      const stopPromise = worker.stop();

      // Resolve provider after a delay
      setTimeout(() => resolveProvider!(), 100);

      // Both should complete
      await stopPromise;
      await startPromise;

      // Retry should be acknowledged
      expect(storageAdapter.ackedRetries).toContain('retry-1');
    });
  });
});
