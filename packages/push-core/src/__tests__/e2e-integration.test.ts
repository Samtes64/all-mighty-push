/**
 * End-to-end integration tests for core runtime
 * 
 * Tests the complete flow: configure → send → retry → worker processing
 */

import { PushCore } from '../core/PushCore';
import { RetryWorker } from '../worker/RetryWorker';
import { TokenBucketRateLimiter } from '../rate-limiter/TokenBucketRateLimiter';
import type { StorageAdapter, ProviderAdapter } from '../types/adapters';
import type { Subscription } from '../types/subscription';
import type { NotificationPayload } from '../types/notification';
import type { ProviderResult, RetryEntry, QueueStats } from '../types/results';
import type { RetryPolicy } from '../types/configuration';

// Mock storage adapter for integration testing
class IntegrationStorageAdapter implements StorageAdapter {
  subscriptions: Map<string, Subscription> = new Map();
  retryQueue: RetryEntry[] = [];
  dequeuedRetries: RetryEntry[] = [];

  async createSubscription(data: any): Promise<Subscription> {
    const subscription: Subscription = {
      id: 'sub-' + Date.now() + '-' + Math.random(),
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

// Mock provider adapter for integration testing
class IntegrationProviderAdapter implements ProviderAdapter {
  sendResults: ProviderResult[] = [];
  sendCalls: Array<{ subscription: Subscription; payload: NotificationPayload }> = [];
  callCount: number = 0;

  async send(subscription: Subscription, payload: NotificationPayload): Promise<ProviderResult> {
    this.callCount++;
    this.sendCalls.push({ subscription, payload });
    return this.sendResults.shift() || { success: true, shouldRetry: false };
  }

  getName(): string {
    return 'integration-provider';
  }
}

describe('End-to-End Integration Tests', () => {
  let pushCore: PushCore;
  let worker: RetryWorker;
  let storage: IntegrationStorageAdapter;
  let provider: IntegrationProviderAdapter;

  beforeEach(() => {
    storage = new IntegrationStorageAdapter();
    provider = new IntegrationProviderAdapter();
    pushCore = new PushCore();
  });

  afterEach(async () => {
    if (worker && worker.isRunning()) {
      await worker.stop();
    }
    if (pushCore) {
      await pushCore.shutdown(1000);
    }
  });

  describe('Complete Send Flow', () => {
    it('should configure → send → verify storage update', async () => {
      // Configure
      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
        storageAdapter: storage,
        providerAdapter: provider,
      });

      // Create subscription
      const subscription = await storage.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });

      const payload: NotificationPayload = {
        title: 'Integration Test',
        body: 'Testing end-to-end flow',
      };

      // Send notification
      const result = await pushCore.sendNotification(subscription, payload);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.subscriptionId).toBe(subscription.id);

      // Verify provider was called
      expect(provider.sendCalls).toHaveLength(1);
      expect(provider.sendCalls[0].payload).toEqual(payload);

      // Verify storage was updated
      const updated = await storage.getSubscriptionById(subscription.id);
      expect(updated?.lastUsedAt).toBeDefined();
      expect(updated?.failedCount).toBe(0);
    });

    it('should handle batch send with mixed results', async () => {
      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
        storageAdapter: storage,
        providerAdapter: provider,
        batchConfig: {
          batchSize: 10,
          concurrency: 5,
        },
      });

      // Create multiple subscriptions
      const subscriptions = await Promise.all([
        storage.createSubscription({
          endpoint: 'https://push.example.com/sub-1',
          keys: { p256dh: 'p256dh-1', auth: 'auth-1' },
          status: 'active',
        }),
        storage.createSubscription({
          endpoint: 'https://push.example.com/sub-2',
          keys: { p256dh: 'p256dh-2', auth: 'auth-2' },
          status: 'active',
        }),
        storage.createSubscription({
          endpoint: 'https://push.example.com/sub-3',
          keys: { p256dh: 'p256dh-3', auth: 'auth-3' },
          status: 'active',
        }),
      ]);

      // Set up mixed results
      provider.sendResults.push({ success: true, shouldRetry: false });
      provider.sendResults.push({ success: false, statusCode: 500, shouldRetry: true });
      provider.sendResults.push({ success: true, shouldRetry: false });

      const payload: NotificationPayload = {
        title: 'Batch Test',
        body: 'Testing batch send',
      };

      // Send batch
      const result = await pushCore.batchSend(subscriptions, payload);

      // Verify results
      expect(result.total).toBe(3);
      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.retried).toBe(1);

      // Verify retry was enqueued
      expect(storage.retryQueue).toHaveLength(1);
      expect(storage.retryQueue[0].subscriptionId).toBe(subscriptions[1].id);
    });
  });

  describe('Retry Flow with Worker', () => {
    it('should send failure → enqueue → worker process → retry → success', async () => {
      // Configure PushCore
      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
        storageAdapter: storage,
        providerAdapter: provider,
        retryPolicy: {
          maxRetries: 3,
          baseDelay: 100,
          backoffFactor: 2,
          maxDelay: 10000,
          jitter: false,
        },
      });

      // Create subscription
      const subscription = await storage.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });

      const payload: NotificationPayload = {
        title: 'Retry Test',
        body: 'Testing retry flow',
      };

      // First send fails
      provider.sendResults.push({
        success: false,
        statusCode: 500,
        shouldRetry: true,
      });

      // Send notification (will fail and enqueue)
      const sendResult = await pushCore.sendNotification(subscription, payload);

      expect(sendResult.success).toBe(false);
      expect(sendResult.enqueued).toBe(true);
      expect(storage.retryQueue).toHaveLength(1);

      // Second attempt succeeds
      provider.sendResults.push({ success: true, shouldRetry: false });

      // Start worker to process retry
      const retryPolicy: RetryPolicy = {
        maxRetries: pushCore.getConfiguration()!.retryPolicy?.maxRetries ?? 3,
        baseDelay: pushCore.getConfiguration()!.retryPolicy?.baseDelay ?? 1000,
        backoffFactor: pushCore.getConfiguration()!.retryPolicy?.backoffFactor ?? 2,
        maxDelay: pushCore.getConfiguration()!.retryPolicy?.maxDelay ?? 3600000,
        jitter: pushCore.getConfiguration()!.retryPolicy?.jitter !== false,
      };

      worker = new RetryWorker(
        storage,
        provider,
        retryPolicy,
        {
          pollInterval: 50,
          concurrency: 5,
          batchSize: 10,
        }
      );

      const workerPromise = worker.start();

      // Wait for worker to process
      await new Promise(resolve => setTimeout(resolve, 200));

      await worker.stop();
      await workerPromise;

      // Verify retry was processed
      expect(provider.callCount).toBe(2); // Initial send + retry
      expect(storage.retryQueue).toHaveLength(0); // Retry was acked

      // Verify subscription was updated
      const updated = await storage.getSubscriptionById(subscription.id);
      expect(updated?.lastUsedAt).toBeDefined();
      expect(updated?.failedCount).toBe(0);
    });

    it.skip('should handle max retries exceeded', async () => {
      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
        storageAdapter: storage,
        providerAdapter: provider,
        retryPolicy: {
          maxRetries: 1, // Only 1 retry to make test faster
          baseDelay: 50,
          backoffFactor: 2,
          maxDelay: 10000,
          jitter: false,
        },
      });

      const subscription = await storage.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });

      const payload: NotificationPayload = {
        title: 'Max Retries Test',
        body: 'Testing max retries',
      };

      // All attempts fail
      provider.sendResults.push({ success: false, statusCode: 500, shouldRetry: true });
      provider.sendResults.push({ success: false, statusCode: 500, shouldRetry: true });

      // Initial send
      await pushCore.sendNotification(subscription, payload);
      expect(storage.retryQueue).toHaveLength(1);

      // Start worker
      const retryPolicy: RetryPolicy = {
        maxRetries: 1,
        baseDelay: 50,
        backoffFactor: 2,
        maxDelay: 10000,
        jitter: false,
      };

      worker = new RetryWorker(
        storage,
        provider,
        retryPolicy,
        {
          pollInterval: 50,
        }
      );

      const workerPromise = worker.start();

      // Wait for retry to be processed
      await new Promise(resolve => setTimeout(resolve, 300));

      await worker.stop();
      await workerPromise;

      // Verify subscription was marked as expired
      const updated = await storage.getSubscriptionById(subscription.id);
      expect(updated?.status).toBe('expired');
      expect(storage.retryQueue).toHaveLength(0);
    });
  });

  describe('Circuit Breaker Integration', () => {
    it.skip('should track failures through circuit breaker', async () => {
      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
        storageAdapter: storage,
        providerAdapter: provider,
        circuitBreaker: {
          failureThreshold: 2,
          resetTimeout: 1000,
          halfOpenMaxAttempts: 1,
        },
      });

      const subscription = await storage.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });

      const payload: NotificationPayload = {
        title: 'Circuit Breaker Test',
        body: 'Testing circuit breaker',
      };

      // Cause failures
      provider.sendResults.push({
        success: false,
        statusCode: 500,
        shouldRetry: false,
        error: new Error('Server error'),
      });
      provider.sendResults.push({
        success: false,
        statusCode: 500,
        shouldRetry: false,
        error: new Error('Server error'),
      });

      // Send notifications to trigger failures
      await pushCore.sendNotification(subscription, payload);
      await pushCore.sendNotification(subscription, payload);

      // Circuit breaker should now be open, next request should be blocked
      const result = await pushCore.sendNotification(subscription, payload);
      
      // Should fail with circuit breaker error
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Rate Limiter Integration', () => {
    it('should enforce rate limits', async () => {
      const rateLimiter = new TokenBucketRateLimiter(2, 1); // 2 tokens, 1 per second

      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
        storageAdapter: storage,
        providerAdapter: provider,
        rateLimiter,
      });

      const subscription = await storage.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });

      const payload: NotificationPayload = {
        title: 'Rate Limit Test',
        body: 'Testing rate limiter',
      };

      const startTime = Date.now();

      // Send 3 notifications (should take time due to rate limit)
      await Promise.all([
        pushCore.sendNotification(subscription, payload),
        pushCore.sendNotification(subscription, payload),
        pushCore.sendNotification(subscription, payload),
      ]);

      const elapsed = Date.now() - startTime;

      // Should take at least 1 second for the 3rd request
      expect(elapsed).toBeGreaterThanOrEqual(900); // Allow some tolerance
      expect(provider.callCount).toBe(3);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should complete in-flight operations before shutdown', async () => {
      let resolveProvider: () => void;
      const providerPromise = new Promise<ProviderResult>((resolve) => {
        resolveProvider = () => resolve({ success: true, shouldRetry: false });
      });

      const slowProvider: ProviderAdapter = {
        send: () => providerPromise,
        getName: () => 'slow-provider',
      };

      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
        storageAdapter: storage,
        providerAdapter: slowProvider,
      });

      const subscription = await storage.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });

      const payload: NotificationPayload = {
        title: 'Shutdown Test',
        body: 'Testing graceful shutdown',
      };

      // Start send operation
      const sendPromise = pushCore.sendNotification(subscription, payload);

      // Start shutdown
      const shutdownPromise = pushCore.shutdown(5000);

      // Resolve provider after delay
      setTimeout(() => resolveProvider!(), 100);

      // Both should complete
      await expect(sendPromise).resolves.toBeDefined();
      await expect(shutdownPromise).resolves.toBeUndefined();
    });
  });
});
