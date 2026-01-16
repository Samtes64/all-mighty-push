/**
 * Adapter interfaces for pluggable storage and provider implementations
 */

import { Subscription, CreateSubscriptionData, SubscriptionFilter } from './subscription';
import { NotificationPayload, SendOptions } from './notification';
import { ProviderResult, RetryEntry, QueueStats } from './results';

/**
 * Storage adapter interface for persisting subscriptions and retry queue
 */
export interface StorageAdapter {
  // Subscription management methods

  /**
   * Create a new subscription
   * @param data - Subscription data to create
   * @returns The created subscription with generated ID and timestamps
   */
  createSubscription(data: CreateSubscriptionData): Promise<Subscription>;

  /**
   * Retrieve a subscription by its ID
   * @param id - Subscription ID
   * @returns The subscription if found, null otherwise
   */
  getSubscriptionById(id: string): Promise<Subscription | null>;

  /**
   * Find subscriptions matching filter criteria
   * @param filter - Filter criteria
   * @returns Array of matching subscriptions
   */
  findSubscriptions(filter: SubscriptionFilter): Promise<Subscription[]>;

  /**
   * Update a subscription
   * @param id - Subscription ID
   * @param updates - Partial subscription data to update
   * @returns The updated subscription
   */
  updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription>;

  /**
   * Delete a subscription
   * @param id - Subscription ID
   */
  deleteSubscription(id: string): Promise<void>;

  // Retry queue management methods

  /**
   * Add an entry to the retry queue
   * @param retry - Retry entry to enqueue
   */
  enqueueRetry(retry: RetryEntry): Promise<void>;

  /**
   * Retrieve entries from the retry queue that are ready to be processed
   * @param limit - Maximum number of entries to retrieve
   * @returns Array of retry entries with nextRetryAt in the past
   */
  dequeueRetry(limit: number): Promise<RetryEntry[]>;

  /**
   * Acknowledge that a retry entry has been processed
   * @param retryId - Retry entry ID
   */
  ackRetry(retryId: string): Promise<void>;

  /**
   * Get statistics about the retry queue
   * @returns Queue statistics
   */
  getQueueStats(): Promise<QueueStats>;

  // Optional migration support

  /**
   * Run database migrations (optional, for adapters that support schema management)
   */
  migrate?(): Promise<void>;

  // Lifecycle methods

  /**
   * Close all connections and clean up resources
   */
  close(): Promise<void>;
}

/**
 * Provider adapter interface for sending notifications through push services
 */
export interface ProviderAdapter {
  /**
   * Send a notification to a subscription
   * @param subscription - Target subscription
   * @param payload - Notification payload
   * @param options - Send options
   * @returns Result of the send operation
   */
  send(
    subscription: Subscription,
    payload: NotificationPayload,
    options: SendOptions
  ): Promise<ProviderResult>;

  /**
   * Get the name of this provider
   * @returns Provider name (e.g., "web-push")
   */
  getName(): string;
}

/**
 * Metrics adapter interface for collecting operational metrics
 */
export interface MetricsAdapter {
  /**
   * Increment a counter metric
   * @param metric - Metric name
   * @param tags - Optional tags for the metric
   */
  increment(metric: string, tags?: Record<string, string>): void;

  /**
   * Set a gauge metric to a specific value
   * @param metric - Metric name
   * @param value - Metric value
   * @param tags - Optional tags for the metric
   */
  gauge(metric: string, value: number, tags?: Record<string, string>): void;

  /**
   * Record a timing metric
   * @param metric - Metric name
   * @param duration - Duration in milliseconds
   * @param tags - Optional tags for the metric
   */
  timing(metric: string, duration: number, tags?: Record<string, string>): void;

  /**
   * Record a histogram metric
   * @param metric - Metric name
   * @param value - Metric value
   * @param tags - Optional tags for the metric
   */
  histogram(metric: string, value: number, tags?: Record<string, string>): void;
}

/**
 * Rate limiter interface for controlling request rates
 */
export interface RateLimiter {
  /**
   * Acquire tokens from the rate limiter (blocking)
   * @param tokens - Number of tokens to acquire (default: 1)
   * @returns Promise that resolves when tokens are available
   */
  acquire(tokens?: number): Promise<void>;

  /**
   * Try to acquire tokens without blocking
   * @param tokens - Number of tokens to acquire (default: 1)
   * @returns True if tokens were acquired, false otherwise
   */
  tryAcquire(tokens?: number): boolean;

  /**
   * Get the number of available tokens
   * @returns Number of available tokens
   */
  getAvailableTokens(): number;
}
