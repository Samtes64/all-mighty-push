/**
 * Tests for PushCore class
 */

import { PushCore } from '../PushCore';
import type { StorageAdapter, ProviderAdapter } from '../../types/adapters';
import type { Subscription } from '../../types/subscription';
import type { NotificationPayload } from '../../types/notification';
import type { ProviderResult, RetryEntry, QueueStats } from '../../types/results';
import { ConfigurationError, ValidationError } from '../../types/errors';

// Mock storage adapter
class MockStorageAdapter implements StorageAdapter {
  subscriptions: Map<string, Subscription> = new Map();
  retryQueue: RetryEntry[] = [];

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
    const ready = this.retryQueue.filter(r => r.nextRetryAt <= now).slice(0, limit);
    return ready;
  }

  async ackRetry(retryId: string): Promise<void> {
    this.retryQueue = this.retryQueue.filter(r => r.id !== retryId);
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

describe('PushCore', () => {
  let pushCore: PushCore;
  let storageAdapter: MockStorageAdapter;
  let providerAdapter: MockProviderAdapter;

  beforeEach(() => {
    pushCore = new PushCore();
    storageAdapter = new MockStorageAdapter();
    providerAdapter = new MockProviderAdapter();
  });

  describe('configure', () => {
    it('should store configuration', () => {
      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
        storageAdapter,
      });

      const config = pushCore.getConfiguration();
      expect(config).toBeDefined();
      expect(config?.vapidKeys.publicKey).toBe('test-public-key');
      expect(config?.storageAdapter).toBe(storageAdapter);
    });

    it('should merge configuration with defaults', () => {
      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
        storageAdapter,
      });

      const config = pushCore.getConfiguration();
      expect(config?.retryPolicy?.maxRetries).toBe(8);
      expect(config?.retryPolicy?.baseDelay).toBe(1000);
      expect(config?.circuitBreaker?.failureThreshold).toBe(5);
      expect(config?.batchConfig?.batchSize).toBe(50);
    });

    it('should allow partial configuration updates', () => {
      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
        storageAdapter,
      });

      pushCore.configure({
        retryPolicy: {
          maxRetries: 5,
        },
      });

      const config = pushCore.getConfiguration();
      expect(config?.retryPolicy?.maxRetries).toBe(5);
      expect(config?.retryPolicy?.baseDelay).toBe(1000); // Still has default
      expect(config?.vapidKeys.publicKey).toBe('test-public-key'); // Preserved
    });
  });

  describe('validateConfiguration', () => {
    it('should throw if not configured', async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      await expect(pushCore.sendNotification(subscription, payload)).rejects.toThrow(
        ConfigurationError
      );
      await expect(pushCore.sendNotification(subscription, payload)).rejects.toThrow(
        'not configured'
      );
    });

    it('should throw if VAPID keys are missing', async () => {
      pushCore.configure({
        storageAdapter,
      } as any);

      const subscription = createMockSubscription();
      const payload = createMockPayload();

      await expect(pushCore.sendNotification(subscription, payload)).rejects.toThrow(
        ConfigurationError
      );
      await expect(pushCore.sendNotification(subscription, payload)).rejects.toThrow(
        'VAPID keys are required'
      );
    });

    it('should throw if storage adapter is missing', async () => {
      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
      } as any);

      const subscription = createMockSubscription();
      const payload = createMockPayload();

      await expect(pushCore.sendNotification(subscription, payload)).rejects.toThrow(
        ConfigurationError
      );
      await expect(pushCore.sendNotification(subscription, payload)).rejects.toThrow(
        'Storage adapter is required'
      );
    });
  });

  describe('verifySubscription', () => {
    beforeEach(() => {
      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
        storageAdapter,
        providerAdapter,
      });
    });

    it('should accept valid subscription', async () => {
      const subscription = createMockSubscription();
      await expect(pushCore.verifySubscription(subscription)).resolves.toBeUndefined();
    });

    it('should reject subscription without endpoint', async () => {
      const subscription = createMockSubscription();
      delete (subscription as any).endpoint;

      await expect(pushCore.verifySubscription(subscription)).rejects.toThrow(ValidationError);
      await expect(pushCore.verifySubscription(subscription)).rejects.toThrow('endpoint');
    });

    it('should reject subscription without keys', async () => {
      const subscription = createMockSubscription();
      delete (subscription as any).keys;

      await expect(pushCore.verifySubscription(subscription)).rejects.toThrow(ValidationError);
      await expect(pushCore.verifySubscription(subscription)).rejects.toThrow('keys');
    });

    it('should reject subscription without keys.p256dh', async () => {
      const subscription = createMockSubscription();
      delete (subscription.keys as any).p256dh;

      await expect(pushCore.verifySubscription(subscription)).rejects.toThrow(ValidationError);
      await expect(pushCore.verifySubscription(subscription)).rejects.toThrow('p256dh');
    });

    it('should reject subscription without keys.auth', async () => {
      const subscription = createMockSubscription();
      delete (subscription.keys as any).auth;

      await expect(pushCore.verifySubscription(subscription)).rejects.toThrow(ValidationError);
      await expect(pushCore.verifySubscription(subscription)).rejects.toThrow('auth');
    });
  });

  describe('sendNotification', () => {
    beforeEach(() => {
      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
        storageAdapter,
        providerAdapter,
      });
    });

    it('should send notification successfully', async () => {
      const subscription = await storageAdapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });
      const payload = createMockPayload();

      const result = await pushCore.sendNotification(subscription, payload);

      expect(result.success).toBe(true);
      expect(result.subscriptionId).toBe(subscription.id);
      expect(providerAdapter.sendCalls).toHaveLength(1);
      expect(providerAdapter.sendCalls[0].subscription).toMatchObject({
        id: subscription.id,
        endpoint: subscription.endpoint,
      });
      expect(providerAdapter.sendCalls[0].payload).toBe(payload);
    });

    it('should update subscription lastUsedAt on success', async () => {
      const subscription = await storageAdapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });
      const payload = createMockPayload();

      const beforeTime = new Date();
      await pushCore.sendNotification(subscription, payload);
      const afterTime = new Date();

      const updated = await storageAdapter.getSubscriptionById(subscription.id);
      expect(updated?.lastUsedAt).toBeDefined();
      expect(updated!.lastUsedAt!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(updated!.lastUsedAt!.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should enqueue retry on retriable failure', async () => {
      providerAdapter.sendResults.push({
        success: false,
        statusCode: 500,
        shouldRetry: true,
        error: new Error('Server error'),
      });

      const subscription = await storageAdapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });
      const payload = createMockPayload();

      const result = await pushCore.sendNotification(subscription, payload);

      expect(result.success).toBe(false);
      expect(result.enqueued).toBe(true);
      expect(storageAdapter.retryQueue).toHaveLength(1);
      expect(storageAdapter.retryQueue[0].subscriptionId).toBe(subscription.id);
      expect(storageAdapter.retryQueue[0].attempt).toBe(0);
    });

    it('should not enqueue retry on non-retriable failure', async () => {
      providerAdapter.sendResults.push({
        success: false,
        statusCode: 410,
        shouldRetry: false,
        error: new Error('Gone'),
      });

      const subscription = await storageAdapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });
      const payload = createMockPayload();

      const result = await pushCore.sendNotification(subscription, payload);

      expect(result.success).toBe(false);
      expect(result.enqueued).toBe(false);
      expect(storageAdapter.retryQueue).toHaveLength(0);
    });

    it('should respect Retry-After header', async () => {
      providerAdapter.sendResults.push({
        success: false,
        statusCode: 429,
        shouldRetry: true,
        retryAfter: 60, // 60 seconds
      });

      const subscription = await storageAdapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });
      const payload = createMockPayload();

      const beforeTime = Date.now();
      await pushCore.sendNotification(subscription, payload);
      const afterTime = Date.now();

      expect(storageAdapter.retryQueue).toHaveLength(1);
      const retryEntry = storageAdapter.retryQueue[0];
      const expectedRetryTime = beforeTime + 60 * 1000;
      
      // Allow 100ms tolerance for test execution time
      expect(retryEntry.nextRetryAt.getTime()).toBeGreaterThanOrEqual(expectedRetryTime - 100);
      expect(retryEntry.nextRetryAt.getTime()).toBeLessThanOrEqual(afterTime + 60 * 1000 + 100);
    });

    it('should call lifecycle hooks', async () => {
      const hooks = {
        onSend: jest.fn(),
        onSuccess: jest.fn(),
        onFailure: jest.fn(),
      };

      pushCore.configure({
        lifecycleHooks: hooks,
      });

      const subscription = await storageAdapter.createSubscription({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        status: 'active',
      });
      const payload = createMockPayload();

      await pushCore.sendNotification(subscription, payload);

      expect(hooks.onSend).toHaveBeenCalledWith(subscription, payload);
      expect(hooks.onSuccess).toHaveBeenCalled();
      expect(hooks.onFailure).not.toHaveBeenCalled();
    });
  });

  describe('batchSend', () => {
    beforeEach(() => {
      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
        storageAdapter,
        providerAdapter,
      });
    });

    it('should send to multiple subscriptions', async () => {
      const subscriptions = await Promise.all([
        storageAdapter.createSubscription({
          endpoint: 'https://push.example.com/sub-1',
          keys: { p256dh: 'test-p256dh-1', auth: 'test-auth-1' },
          status: 'active',
        }),
        storageAdapter.createSubscription({
          endpoint: 'https://push.example.com/sub-2',
          keys: { p256dh: 'test-p256dh-2', auth: 'test-auth-2' },
          status: 'active',
        }),
        storageAdapter.createSubscription({
          endpoint: 'https://push.example.com/sub-3',
          keys: { p256dh: 'test-p256dh-3', auth: 'test-auth-3' },
          status: 'active',
        }),
      ]);
      const payload = createMockPayload();

      const result = await pushCore.batchSend(subscriptions, payload);

      expect(result.total).toBe(3);
      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(providerAdapter.sendCalls).toHaveLength(3);
    });

    it('should handle individual failures without blocking batch', async () => {
      providerAdapter.sendResults.push({ success: true, shouldRetry: false });
      providerAdapter.sendResults.push({
        success: false,
        statusCode: 410,
        shouldRetry: false,
      });
      providerAdapter.sendResults.push({ success: true, shouldRetry: false });

      const subscriptions = await Promise.all([
        storageAdapter.createSubscription({
          endpoint: 'https://push.example.com/sub-1',
          keys: { p256dh: 'test-p256dh-1', auth: 'test-auth-1' },
          status: 'active',
        }),
        storageAdapter.createSubscription({
          endpoint: 'https://push.example.com/sub-2',
          keys: { p256dh: 'test-p256dh-2', auth: 'test-auth-2' },
          status: 'active',
        }),
        storageAdapter.createSubscription({
          endpoint: 'https://push.example.com/sub-3',
          keys: { p256dh: 'test-p256dh-3', auth: 'test-auth-3' },
          status: 'active',
        }),
      ]);
      const payload = createMockPayload();

      const result = await pushCore.batchSend(subscriptions, payload);

      expect(result.total).toBe(3);
      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
      expect(providerAdapter.sendCalls).toHaveLength(3);
    });

    it('should respect batch size configuration', async () => {
      pushCore.configure({
        batchConfig: {
          batchSize: 2,
        },
      });

      const subscriptions = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          storageAdapter.createSubscription({
            endpoint: `https://push.example.com/sub-${i}`,
            keys: { p256dh: `test-p256dh-${i}`, auth: `test-auth-${i}` },
            status: 'active',
          })
        )
      );
      const payload = createMockPayload();

      const result = await pushCore.batchSend(subscriptions, payload);

      expect(result.total).toBe(5);
      expect(result.success).toBe(5);
      expect(providerAdapter.sendCalls).toHaveLength(5);
    });

    it('should track retry statistics', async () => {
      providerAdapter.sendResults.push({ success: true, shouldRetry: false });
      providerAdapter.sendResults.push({
        success: false,
        statusCode: 500,
        shouldRetry: true,
      });
      providerAdapter.sendResults.push({
        success: false,
        statusCode: 410,
        shouldRetry: false,
      });

      const subscriptions = await Promise.all([
        storageAdapter.createSubscription({
          endpoint: 'https://push.example.com/sub-1',
          keys: { p256dh: 'test-p256dh-1', auth: 'test-auth-1' },
          status: 'active',
        }),
        storageAdapter.createSubscription({
          endpoint: 'https://push.example.com/sub-2',
          keys: { p256dh: 'test-p256dh-2', auth: 'test-auth-2' },
          status: 'active',
        }),
        storageAdapter.createSubscription({
          endpoint: 'https://push.example.com/sub-3',
          keys: { p256dh: 'test-p256dh-3', auth: 'test-auth-3' },
          status: 'active',
        }),
      ]);
      const payload = createMockPayload();

      const result = await pushCore.batchSend(subscriptions, payload);

      expect(result.total).toBe(3);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.retried).toBe(1);
    });

    it('should handle empty batch', async () => {
      const payload = createMockPayload();

      const result = await pushCore.batchSend([], payload);

      expect(result.total).toBe(0);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.retried).toBe(0);
      expect(result.results).toHaveLength(0);
    });
  });

  describe('shutdown', () => {
    beforeEach(() => {
      pushCore.configure({
        vapidKeys: {
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
        },
        storageAdapter,
        providerAdapter,
      });
    });

    it('should prevent new operations after shutdown', async () => {
      await pushCore.shutdown();

      const subscription = createMockSubscription();
      const payload = createMockPayload();

      await expect(pushCore.sendNotification(subscription, payload)).rejects.toThrow(
        'shutting down'
      );
    });

    it('should wait for in-flight operations', async () => {
      let resolveProvider: () => void;
      const providerPromise = new Promise<ProviderResult>((resolve) => {
        resolveProvider = () => resolve({ success: true, shouldRetry: false });
      });

      const slowProvider: ProviderAdapter = {
        send: () => providerPromise,
        getName: () => 'slow-provider',
      };

      pushCore.configure({ providerAdapter: slowProvider });

      const subscription = createMockSubscription();
      const payload = createMockPayload();

      // Start send operation
      const sendPromise = pushCore.sendNotification(subscription, payload);

      // Start shutdown
      const shutdownPromise = pushCore.shutdown(5000);

      // Resolve the provider after a delay
      setTimeout(() => resolveProvider!(), 100);

      // Both should complete
      await expect(sendPromise).resolves.toBeDefined();
      await expect(shutdownPromise).resolves.toBeUndefined();
    });

    it('should timeout if operations take too long', async () => {
      const neverResolveProvider: ProviderAdapter = {
        send: () => new Promise(() => {}), // Never resolves
        getName: () => 'never-provider',
      };

      pushCore.configure({ providerAdapter: neverResolveProvider });

      const subscription = createMockSubscription();
      const payload = createMockPayload();

      // Start send operation that will never complete
      pushCore.sendNotification(subscription, payload);

      // Shutdown with short timeout
      const shutdownPromise = pushCore.shutdown(100);

      await expect(shutdownPromise).resolves.toBeUndefined();
    });

    it('should close storage adapter', async () => {
      const closeSpy = jest.spyOn(storageAdapter, 'close');

      await pushCore.shutdown();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle concurrent shutdown calls', async () => {
      const shutdown1 = pushCore.shutdown();
      const shutdown2 = pushCore.shutdown();

      await expect(Promise.all([shutdown1, shutdown2])).resolves.toBeDefined();
    });
  });
});

// Helper functions
function createMockSubscription(id: string = 'test-sub-id'): Subscription {
  return {
    id,
    endpoint: 'https://push.example.com/test',
    keys: {
      p256dh: 'test-p256dh-key',
      auth: 'test-auth-key',
    },
    status: 'active',
    failedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMockPayload(): NotificationPayload {
  return {
    title: 'Test Notification',
    body: 'This is a test notification',
  };
}
