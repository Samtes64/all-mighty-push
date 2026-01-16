/**
 * Notification payload and action types
 */

/**
 * Action button for a notification
 */
export interface NotificationAction {
  /** Unique identifier for the action */
  action: string;
  /** Text displayed on the action button */
  title: string;
  /** Optional icon URL for the action */
  icon?: string;
}

/**
 * Payload for a push notification
 */
export interface NotificationPayload {
  /** Notification title (required) */
  title: string;
  /** Notification body text (required) */
  body: string;
  /** Optional icon URL */
  icon?: string;
  /** Optional badge URL */
  badge?: string;
  /** Optional custom data */
  data?: Record<string, unknown>;
  /** Optional action buttons */
  actions?: NotificationAction[];
  /** Optional tag for grouping/replacing notifications */
  tag?: string;
  /** Whether the notification should persist until user interaction */
  requireInteraction?: boolean;
}

/**
 * Options for sending a notification
 */
export interface SendOptions {
  /** Time-to-live in seconds (how long the push service should queue the message) */
  ttl?: number;
  /** Urgency hint for the push service */
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  /** Topic for replacing previous notifications */
  topic?: string;
}
