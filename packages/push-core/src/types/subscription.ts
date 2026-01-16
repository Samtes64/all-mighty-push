/**
 * Subscription-related types
 */

/**
 * Status of a push notification subscription
 */
export type SubscriptionStatus = 'active' | 'blocked' | 'expired';

/**
 * Encryption keys for push notification subscription
 */
export interface SubscriptionKeys {
  /** Public key for P-256 ECDH (base64-encoded, 65 bytes when decoded) */
  p256dh: string;
  /** Authentication secret (base64-encoded, 16 bytes when decoded) */
  auth: string;
}

/**
 * Complete push notification subscription record
 */
export interface Subscription {
  /** Unique identifier (UUID v4) */
  id: string;
  /** Push service endpoint URL (must be HTTPS) */
  endpoint: string;
  /** Encryption keys for the subscription */
  keys: SubscriptionKeys;
  /** Optional user identifier for associating subscription with a user */
  userId?: string;
  /** Timestamp when the subscription was created */
  createdAt: Date;
  /** Timestamp when the subscription was last updated */
  updatedAt: Date;
  /** Timestamp of the last successful notification send */
  lastUsedAt?: Date;
  /** Count of consecutive failed notification attempts */
  failedCount: number;
  /** Current status of the subscription */
  status: SubscriptionStatus;
  /** Optional expiration timestamp */
  expiresAt?: Date;
  /** Arbitrary metadata for application-specific data */
  metadata?: Record<string, unknown>;
}

/**
 * Data required to create a new subscription
 */
export interface CreateSubscriptionData {
  /** Push service endpoint URL */
  endpoint: string;
  /** Encryption keys */
  keys: SubscriptionKeys;
  /** Optional user identifier */
  userId?: string;
  /** Optional expiration timestamp */
  expiresAt?: Date;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Filter criteria for querying subscriptions
 */
export interface SubscriptionFilter {
  /** Filter by user ID */
  userId?: string;
  /** Filter by status */
  status?: SubscriptionStatus;
  /** Filter by IDs */
  ids?: string[];
}
