/**
 * Result types for operations
 */

import { NotificationPayload } from './notification';

/**
 * Result from a provider send operation
 */
export interface ProviderResult {
  /** Whether the send was successful */
  success: boolean;
  /** HTTP status code from the provider (if applicable) */
  statusCode?: number;
  /** Error that occurred (if any) */
  error?: Error;
  /** Whether the operation should be retried */
  shouldRetry: boolean;
  /** Seconds to wait before retrying (from Retry-After header) */
  retryAfter?: number;
}

/**
 * Result from a single notification send
 */
export interface SendResult {
  /** Whether the send was successful */
  success: boolean;
  /** Subscription ID that was sent to */
  subscriptionId: string;
  /** Error that occurred (if any) */
  error?: Error;
  /** Whether the notification was enqueued for retry */
  enqueued?: boolean;
}

/**
 * Result from a batch send operation
 */
export interface BatchResult {
  /** Total number of notifications attempted */
  total: number;
  /** Number of successful sends */
  success: number;
  /** Number of failed sends */
  failed: number;
  /** Number of notifications enqueued for retry */
  retried: number;
  /** Individual results for each subscription */
  results: SendResult[];
}

/**
 * Entry in the retry queue
 */
export interface RetryEntry {
  /** Unique identifier for the retry entry (UUID) */
  id: string;
  /** ID of the subscription to retry */
  subscriptionId: string;
  /** Notification payload to send */
  payload: NotificationPayload;
  /** Current attempt number (0-indexed) */
  attempt: number;
  /** Timestamp when the next retry should be attempted */
  nextRetryAt: Date;
  /** Last error message (if any) */
  lastError?: string;
  /** Timestamp when the entry was first created */
  createdAt: Date;
}

/**
 * Statistics about the retry queue
 */
export interface QueueStats {
  /** Number of entries waiting to be processed */
  pending: number;
  /** Number of entries currently being processed */
  processing: number;
  /** Number of entries that have failed all retries */
  failed: number;
}
