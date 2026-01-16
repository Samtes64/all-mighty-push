/**
 * Retry Worker for processing retry queue
 */

import type { StorageAdapter, ProviderAdapter, MetricsAdapter } from '../types/adapters';
import type { RetryPolicy, WorkerOptions } from '../types/configuration';
import type { RetryEntry } from '../types/results';
import { shouldRetry } from '../retry/shouldRetry';
import { calculateNextRetry } from '../retry/calculateNextRetry';

/**
 * Worker interface for background processing
 */
export interface Worker {
  /** Start the worker polling loop */
  start(): Promise<void>;
  /** Stop the worker gracefully */
  stop(): Promise<void>;
  /** Check if worker is running */
  isRunning(): boolean;
}

/**
 * Default worker options
 */
const DEFAULT_WORKER_OPTIONS: Required<WorkerOptions> = {
  pollInterval: 5000, // 5 seconds
  concurrency: 10,
  batchSize: 50,
  errorBackoff: 10000, // 10 seconds
};

/**
 * Retry Worker
 * 
 * Continuously polls the retry queue and processes pending notifications.
 * 
 * **Validates: Requirements 7.1, 7.2, 7.4, 7.5**
 */
export class RetryWorker implements Worker {
  private running: boolean = false;
  private processing: Set<string> = new Set();
  private options: Required<WorkerOptions>;

  constructor(
    private storage: StorageAdapter,
    private provider: ProviderAdapter,
    private retryPolicy: RetryPolicy,
    options?: WorkerOptions,
    private metricsAdapter?: MetricsAdapter
  ) {
    this.options = {
      ...DEFAULT_WORKER_OPTIONS,
      ...options,
    };
  }

  /**
   * Start the worker polling loop
   * 
   * Continuously polls the retry queue and processes pending entries.
   * Respects concurrency limits and polling intervals.
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Worker is already running');
    }

    this.running = true;
    this.emitMetric('worker.started');

    while (this.running) {
      try {
        // Dequeue pending retries
        const retries = await this.storage.dequeueRetry(this.options.batchSize);

        if (retries.length > 0) {
          this.emitMetric('worker.dequeued', retries.length);

          // Process retries with concurrency control
          await this.processRetriesWithConcurrency(retries);
        }

        // Sleep if no retries or after processing
        if (retries.length === 0 || this.running) {
          await this.sleep(this.options.pollInterval);
        }
      } catch (error) {
        // Log error and back off
        console.error('Worker error:', error);
        this.emitMetric('worker.error');

        if (this.running) {
          await this.sleep(this.options.errorBackoff);
        }
      }
    }

    this.emitMetric('worker.stopped');
  }

  /**
   * Stop the worker gracefully
   * 
   * Sets the running flag to false and waits for in-flight processing to complete.
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Wait for in-flight processing to complete
    while (this.processing.size > 0) {
      await this.sleep(100);
    }
  }

  /**
   * Check if worker is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Process retries with concurrency control
   */
  private async processRetriesWithConcurrency(retries: RetryEntry[]): Promise<void> {
    const chunks: RetryEntry[][] = [];
    
    // Split into chunks based on concurrency
    for (let i = 0; i < retries.length; i += this.options.concurrency) {
      chunks.push(retries.slice(i, i + this.options.concurrency));
    }

    // Process each chunk sequentially, but items within chunk concurrently
    for (const chunk of chunks) {
      if (!this.running) break;

      await Promise.all(
        chunk.map(retry => this.processRetry(retry))
      );
    }
  }

  /**
   * Process a single retry entry
   */
  private async processRetry(retry: RetryEntry): Promise<void> {
    this.processing.add(retry.id);

    try {
      this.emitMetric('worker.retry.processing');

      // Get subscription
      const subscription = await this.storage.getSubscriptionById(retry.subscriptionId);
      
      if (!subscription) {
        // Subscription no longer exists, acknowledge and skip
        await this.storage.ackRetry(retry.id);
        this.emitMetric('worker.retry.subscription_not_found');
        return;
      }

      // Send notification
      const result = await this.provider.send(subscription, retry.payload, {});

      if (result.success) {
        // Success: acknowledge retry and update subscription
        await this.storage.ackRetry(retry.id);
        await this.storage.updateSubscription(subscription.id, {
          lastUsedAt: new Date(),
          failedCount: 0,
        });
        this.emitMetric('worker.retry.success');
      } else {
        // Check if we should retry again
        const shouldRetryAgain = shouldRetry(
          result,
          retry.attempt,
          this.retryPolicy.maxRetries
        );

        if (shouldRetryAgain) {
          // Re-enqueue for another retry
          const nextRetryAt = calculateNextRetry(
            retry.attempt + 1,
            this.retryPolicy,
            result.retryAfter
          );

          await this.storage.enqueueRetry({
            ...retry,
            attempt: retry.attempt + 1,
            nextRetryAt,
            lastError: result.error?.message,
          });

          await this.storage.ackRetry(retry.id);
          this.emitMetric('worker.retry.re_enqueued');
        } else {
          // Max retries exceeded, mark subscription as expired/blocked
          await this.storage.ackRetry(retry.id);
          await this.storage.updateSubscription(subscription.id, {
            status: 'expired',
            failedCount: subscription.failedCount + 1,
          });
          this.emitMetric('worker.retry.max_retries_exceeded');
        }
      }
    } catch (error) {
      // Unexpected error during processing
      console.error('Error processing retry:', error);
      this.emitMetric('worker.retry.error');

      // Acknowledge to prevent infinite loop
      try {
        await this.storage.ackRetry(retry.id);
      } catch (ackError) {
        console.error('Error acknowledging retry:', ackError);
      }
    } finally {
      this.processing.delete(retry.id);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Emit a metric if metrics adapter is configured
   */
  private emitMetric(metric: string, value?: number): void {
    if (this.metricsAdapter) {
      try {
        if (value !== undefined) {
          this.metricsAdapter.gauge(metric, value);
        } else {
          this.metricsAdapter.increment(metric);
        }
      } catch (error) {
        // Log metric errors but don't throw
        console.error(`Error emitting metric ${metric}:`, error);
      }
    }
  }
}
