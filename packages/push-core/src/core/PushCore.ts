/**
 * Core Runtime Engine for Push Notifications
 */

import { randomUUID } from 'crypto';
import type {
  PushConfiguration,
  RetryPolicy,
  CircuitBreakerConfig,
  BatchConfig,
  LifecycleHooks,
} from '../types/configuration';
import type {
  ProviderAdapter,
} from '../types/adapters';
import type { Subscription } from '../types/subscription';
import type { NotificationPayload, SendOptions } from '../types/notification';
import type { SendResult, BatchResult } from '../types/results';
import { ConfigurationError, ValidationError } from '../types/errors';
import { CircuitBreaker } from '../circuit-breaker';
import { calculateNextRetry, shouldRetry } from '../retry';
// import { WebPushProvider } from '@allmightypush/push-webpush';

/**
 * Default configuration values
 */
const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 8,
  baseDelay: 1000,
  backoffFactor: 2,
  maxDelay: 3600000, // 1 hour
  jitter: true,
};

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenMaxAttempts: 3,
};

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 50,
  concurrency: 10,
};

/**
 * Core Runtime Engine
 * 
 * Orchestrates notification sending, retry logic, and lifecycle management.
 * 
 * **Validates: Requirements 14.1, 14.2, 14.3, 14.4**
 */
export class PushCore {
  private config?: PushConfiguration;
  private circuitBreaker?: CircuitBreaker;
  private isShuttingDown: boolean = false;
  private inFlightOperations: Set<Promise<any>> = new Set();

  /**
   * Configure the push notification system
   * 
   * @param options - Configuration options
   */
  configure(options: Partial<PushConfiguration>): void {
    // Merge with existing configuration
    this.config = {
      ...this.config,
      ...options,
      retryPolicy: {
        ...DEFAULT_RETRY_POLICY,
        ...this.config?.retryPolicy,
        ...options.retryPolicy,
      },
      circuitBreaker: {
        ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
        ...this.config?.circuitBreaker,
        ...options.circuitBreaker,
      },
      batchConfig: {
        ...DEFAULT_BATCH_CONFIG,
        ...this.config?.batchConfig,
        ...options.batchConfig,
      },
    } as PushConfiguration;

    // Initialize circuit breaker if config provided
    if (this.config.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
    }
  }

  /**
   * Get the current configuration
   * 
   * @returns Current configuration or undefined if not configured
   */
  getConfiguration(): PushConfiguration | undefined {
    return this.config;
  }

  /**
   * Validate that required configuration is present
   * 
   * @throws {ConfigurationError} If required configuration is missing
   */
  private validateConfiguration(): void {
    if (!this.config) {
      throw new ConfigurationError('Push notification system is not configured. Call configure() first.');
    }

    if (!this.config.vapidKeys) {
      throw new ConfigurationError('VAPID keys are required. Provide vapidKeys in configuration.', {
        missingField: 'vapidKeys',
      });
    }

    if (!this.config.vapidKeys.publicKey || !this.config.vapidKeys.privateKey) {
      throw new ConfigurationError('VAPID keys must include both publicKey and privateKey.', {
        hasPublicKey: !!this.config.vapidKeys.publicKey,
        hasPrivateKey: !!this.config.vapidKeys.privateKey,
      });
    }

    if (!this.config.storageAdapter) {
      throw new ConfigurationError('Storage adapter is required. Provide storageAdapter in configuration.', {
        missingField: 'storageAdapter',
      });
    }
  }

  /**
   * Get or create the provider adapter
   * 
   * @returns Provider adapter instance
   */
  private getProviderAdapter(): ProviderAdapter {
    if (!this.config) {
      throw new ConfigurationError('Configuration is required');
    }

    // Use configured provider
    if (this.config.providerAdapter) {
      return this.config.providerAdapter;
    }

    // Provider adapter is required if not configured
    throw new ConfigurationError('Provider adapter is required. Please configure providerAdapter.');
  }

  /**
   * Check if the system is shutting down
   * 
   * @throws {Error} If system is shutting down
   */
  private ensureNotShuttingDown(): void {
    if (this.isShuttingDown) {
      throw new Error('Push notification system is shutting down. No new operations allowed.');
    }
  }

  /**
   * Track an in-flight operation
   * 
   * @param operation - Promise to track
   * @returns The same promise
   */
  private trackOperation<T>(operation: Promise<T>): Promise<T> {
    this.inFlightOperations.add(operation);
    operation.finally(() => {
      this.inFlightOperations.delete(operation);
    });
    return operation;
  }

  /**
   * Emit a lifecycle hook if configured
   * 
   * @param hookName - Name of the hook
   * @param args - Arguments to pass to the hook
   */
  private async emitHook(hookName: keyof LifecycleHooks, ...args: any[]): Promise<void> {
    const hook = this.config?.lifecycleHooks?.[hookName] as ((...args: any[]) => void | Promise<void>) | undefined;
    if (hook) {
      try {
        await hook(...args);
      } catch (error) {
        // Log hook errors but don't throw
        console.error(`Error in lifecycle hook ${hookName}:`, error);
      }
    }
  }

  /**
   * Emit a metric if metrics adapter is configured
   * 
   * @param metric - Metric name
   * @param value - Metric value (for gauge/timing/histogram)
   * @param tags - Optional tags
   */
  private emitMetric(
    metric: string,
    value?: number,
    tags?: Record<string, string>
  ): void {
    if (this.config?.metricsAdapter) {
      try {
        if (value !== undefined) {
          this.config.metricsAdapter.gauge(metric, value, tags);
        } else {
          this.config.metricsAdapter.increment(metric, tags);
        }
      } catch (error) {
        // Log metric errors but don't throw
        console.error(`Error emitting metric ${metric}:`, error);
      }
    }
  }

  /**
   * Verify that a subscription is valid
   * 
   * @param subscription - Subscription to verify
   * @throws {ValidationError} If subscription is invalid
   * 
   * **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**
   */
  async verifySubscription(subscription: Subscription): Promise<void> {
    // Check for presence of endpoint field
    if (!subscription.endpoint) {
      throw new ValidationError('Subscription must have an endpoint', {
        field: 'endpoint',
        subscription,
      });
    }

    // Check for presence of keys field
    if (!subscription.keys) {
      throw new ValidationError('Subscription must have keys', {
        field: 'keys',
        subscription,
      });
    }

    // Validate keys.p256dh property
    if (!subscription.keys.p256dh) {
      throw new ValidationError('Subscription keys must include p256dh', {
        field: 'keys.p256dh',
        subscription,
      });
    }

    // Validate keys.auth property
    if (!subscription.keys.auth) {
      throw new ValidationError('Subscription keys must include auth', {
        field: 'keys.auth',
        subscription,
      });
    }
  }

  /**
   * Send a notification to a single subscription
   * 
   * @param subscription - Target subscription
   * @param payload - Notification payload
   * @param options - Send options
   * @returns Send result
   * 
   * **Validates: Requirements 5.1, 5.2, 5.5, 6.1, 8.3, 9.2, 10.3**
   */
  async sendNotification(
    subscription: Subscription,
    payload: NotificationPayload,
    options: SendOptions = {}
  ): Promise<SendResult> {
    this.ensureNotShuttingDown();
    this.validateConfiguration();

    const operation = (async () => {
      const startTime = Date.now();

      try {
        // Emit onSend hook
        await this.emitHook('onSend', subscription, payload);
        this.emitMetric('push.send.attempt');

        // Verify subscription is valid
        await this.verifySubscription(subscription);

        // Acquire rate limiter token if configured
        if (this.config!.rateLimiter) {
          await this.config!.rateLimiter.acquire();
        }

        // Get provider adapter
        const provider = this.getProviderAdapter();

        // Send through circuit breaker if configured
        let result;
        if (this.circuitBreaker) {
          result = await this.circuitBreaker.execute(() =>
            provider.send(subscription, payload, options)
          );
        } else {
          result = await provider.send(subscription, payload, options);
        }

        // Handle success
        if (result.success) {
          // Update subscription lastUsedAt timestamp
          await this.config!.storageAdapter.updateSubscription(subscription.id, {
            lastUsedAt: new Date(),
          });

          // Emit success hook and metrics
          await this.emitHook('onSuccess', subscription, result);
          this.emitMetric('push.send.success');
          this.emitMetric('push.send.duration', Date.now() - startTime);

          return {
            success: true,
            subscriptionId: subscription.id,
          };
        }

        // Handle failure - check if we should retry
        const retryPolicy: RetryPolicy = {
          maxRetries: this.config!.retryPolicy?.maxRetries ?? 8,
          baseDelay: this.config!.retryPolicy?.baseDelay ?? 1000,
          backoffFactor: this.config!.retryPolicy?.backoffFactor ?? 2,
          maxDelay: this.config!.retryPolicy?.maxDelay ?? 3600000,
          jitter: this.config!.retryPolicy?.jitter !== false,
        };

        const shouldRetryResult = shouldRetry(
          result,
          0, // First attempt
          retryPolicy.maxRetries
        );

        if (shouldRetryResult) {
          // Calculate next retry time
          const nextRetryAt = calculateNextRetry(
            0, // First attempt
            retryPolicy,
            result.retryAfter
          );

          // Enqueue for retry
          await this.config!.storageAdapter.enqueueRetry({
            id: randomUUID(),
            subscriptionId: subscription.id,
            payload,
            attempt: 0,
            nextRetryAt,
            lastError: result.error?.message,
            createdAt: new Date(),
          });

          // Emit retry hook and metrics
          await this.emitHook('onRetry', subscription, 0);
          this.emitMetric('push.send.retry_enqueued');

          return {
            success: false,
            subscriptionId: subscription.id,
            error: result.error,
            enqueued: true,
          };
        }

        // Non-retriable failure
        await this.emitHook('onFailure', subscription, result.error || new Error('Send failed'));
        this.emitMetric('push.send.failure');

        return {
          success: false,
          subscriptionId: subscription.id,
          error: result.error,
          enqueued: false,
        };
      } catch (error) {
        // Handle unexpected errors
        const err = error instanceof Error ? error : new Error(String(error));
        await this.emitHook('onFailure', subscription, err);
        this.emitMetric('push.send.error');

        return {
          success: false,
          subscriptionId: subscription.id,
          error: err,
          enqueued: false,
        };
      }
    })();

    return this.trackOperation(operation);
  }

  /**
   * Send notifications to multiple subscriptions in batches
   * 
   * @param subscriptions - Array of target subscriptions
   * @param payload - Notification payload
   * @param options - Send options
   * @returns Batch result with statistics
   * 
   * **Validates: Requirements 5.3, 5.4, 19.1, 19.2, 19.3, 19.5**
   */
  async batchSend(
    subscriptions: Subscription[],
    payload: NotificationPayload,
    options: SendOptions = {}
  ): Promise<BatchResult> {
    this.ensureNotShuttingDown();
    this.validateConfiguration();

    const operation = (async () => {
      const batchSize = this.config!.batchConfig?.batchSize || 50;
      const concurrency = this.config!.batchConfig?.concurrency || 10;

      const results: SendResult[] = [];
      let successCount = 0;
      let failedCount = 0;
      let retriedCount = 0;

      // Split subscriptions into batches
      const batches: Subscription[][] = [];
      for (let i = 0; i < subscriptions.length; i += batchSize) {
        batches.push(subscriptions.slice(i, i + batchSize));
      }

      // Process batches with concurrency control
      for (const batch of batches) {
        // Process batch items with concurrency limit
        for (let i = 0; i < batch.length; i += concurrency) {
          const chunk = batch.slice(i, i + concurrency);
          const chunkResults = await Promise.all(
            chunk.map(subscription =>
              this.sendNotification(subscription, payload, options)
                .catch(error => ({
                  success: false,
                  subscriptionId: subscription.id,
                  error: error instanceof Error ? error : new Error(String(error)),
                  enqueued: false,
                }))
            )
          );
          
          results.push(...chunkResults);
          
          // Update statistics
          for (const result of chunkResults) {
            if (result.success) {
              successCount++;
            } else {
              failedCount++;
              if (result.enqueued) {
                retriedCount++;
              }
            }
          }
        }
      }

      // Emit batch completion metrics
      this.emitMetric('push.batch.total', subscriptions.length);
      this.emitMetric('push.batch.success', successCount);
      this.emitMetric('push.batch.failed', failedCount);
      this.emitMetric('push.batch.retried', retriedCount);

      return {
        total: subscriptions.length,
        success: successCount,
        failed: failedCount,
        retried: retriedCount,
        results,
      };
    })();

    return this.trackOperation(operation);
  }

  /**
   * Gracefully shutdown the push notification system
   * 
   * @param timeout - Maximum time to wait for in-flight operations (milliseconds)
   * @returns Promise that resolves when shutdown is complete
   * 
   * **Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5**
   */
  async shutdown(timeout: number = 30000): Promise<void> {
    // Prevent concurrent shutdown calls
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    try {
      // Wait for in-flight operations with timeout
      const shutdownPromise = Promise.all(Array.from(this.inFlightOperations));
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), timeout);
      });

      await Promise.race([shutdownPromise, timeoutPromise]);

      // Close storage adapter
      if (this.config?.storageAdapter) {
        await this.config.storageAdapter.close();
      }
    } catch (error) {
      console.error('Error during shutdown:', error);
      throw error;
    }
  }
}
