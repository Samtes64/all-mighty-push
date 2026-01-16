/**
 * Configuration types for the push notification library
 */

import { StorageAdapter, ProviderAdapter, MetricsAdapter, RateLimiter } from './adapters';
import { Subscription } from './subscription';
import { NotificationPayload } from './notification';
import { ProviderResult } from './results';

/**
 * VAPID (Voluntary Application Server Identification) credentials
 */
export interface VapidKeys {
  /** VAPID public key (base64url-encoded) */
  publicKey: string;
  /** VAPID private key (base64url-encoded) */
  privateKey: string;
  /** Optional subject (mailto: or https: URL identifying the application) */
  subject?: string;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds for the first retry */
  baseDelay: number;
  /** Backoff factor for exponential backoff (delay multiplier per attempt) */
  backoffFactor: number;
  /** Maximum delay in milliseconds between retries */
  maxDelay: number;
  /** Whether to add random jitter (±25%) to retry delays */
  jitter: boolean;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time in milliseconds to wait before attempting to close the circuit */
  resetTimeout: number;
  /** Number of successful requests needed in half-open state to close the circuit */
  halfOpenMaxAttempts: number;
}

/**
 * Batch processing configuration
 */
export interface BatchConfig {
  /** Maximum number of notifications per batch */
  batchSize: number;
  /** Maximum number of concurrent batch operations */
  concurrency: number;
}

/**
 * Worker configuration
 */
export interface WorkerOptions {
  /** Polling interval in milliseconds */
  pollInterval?: number;
  /** Maximum number of concurrent retry operations */
  concurrency?: number;
  /** Batch size for dequeuing retries */
  batchSize?: number;
  /** Backoff time in milliseconds after an error */
  errorBackoff?: number;
}

/**
 * Lifecycle hooks for observability
 */
export interface LifecycleHooks {
  /**
   * Called before sending a notification
   * @param subscription - Target subscription
   * @param payload - Notification payload
   */
  onSend?: (subscription: Subscription, payload: NotificationPayload) => void | Promise<void>;

  /**
   * Called after a successful send
   * @param subscription - Target subscription
   * @param result - Provider result
   */
  onSuccess?: (subscription: Subscription, result: ProviderResult) => void | Promise<void>;

  /**
   * Called after a failed send
   * @param subscription - Target subscription
   * @param error - Error that occurred
   */
  onFailure?: (subscription: Subscription, error: Error) => void | Promise<void>;

  /**
   * Called when a notification is enqueued for retry
   * @param subscription - Target subscription
   * @param attempt - Retry attempt number
   */
  onRetry?: (subscription: Subscription, attempt: number) => void | Promise<void>;
}

/**
 * Main configuration for the push notification library
 */
export interface PushConfiguration {
  /** VAPID credentials for authentication (required) */
  vapidKeys: VapidKeys;

  /** Storage adapter for subscriptions and retry queue (required) */
  storageAdapter: StorageAdapter;

  /** Provider adapter for sending notifications (optional, defaults to Web Push) */
  providerAdapter?: ProviderAdapter;

  /** Retry policy configuration (optional, uses defaults if not provided) */
  retryPolicy?: Partial<RetryPolicy>;

  /** Rate limiter implementation (optional) */
  rateLimiter?: RateLimiter;

  /** Metrics adapter for observability (optional) */
  metricsAdapter?: MetricsAdapter;

  /** Circuit breaker configuration (optional) */
  circuitBreaker?: Partial<CircuitBreakerConfig>;

  /** Batch processing configuration (optional) */
  batchConfig?: Partial<BatchConfig>;

  /** Lifecycle hooks for observability (optional) */
  lifecycleHooks?: LifecycleHooks;
}

/**
 * Default retry policy values
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 8,
  baseDelay: 1000, // 1 second
  backoffFactor: 2,
  maxDelay: 3600000, // 1 hour
  jitter: true,
};

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenMaxAttempts: 3,
};

/**
 * Default batch configuration
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 50,
  concurrency: 10,
};

/**
 * Default worker options
 */
export const DEFAULT_WORKER_OPTIONS: Required<WorkerOptions> = {
  pollInterval: 5000, // 5 seconds
  concurrency: 10,
  batchSize: 50,
  errorBackoff: 10000, // 10 seconds
};
