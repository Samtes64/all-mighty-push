/**
 * Web Push provider implementation using VAPID authentication
 */

import webPush from 'web-push';
import type {
  ProviderAdapter,
  Subscription,
  NotificationPayload,
  SendOptions,
  ProviderResult,
} from '@allmightypush/push-core';

/**
 * Configuration for the Web Push provider
 */
export interface WebPushProviderConfig {
  /** VAPID public key (base64url-encoded) */
  vapidPublicKey: string;
  /** VAPID private key (base64url-encoded) */
  vapidPrivateKey: string;
  /** VAPID subject (mailto: or https: URL) */
  vapidSubject: string;
}

/**
 * Web Push provider adapter implementing the ProviderAdapter interface
 * 
 * This provider wraps the web-push library to send notifications using
 * the Web Push protocol with VAPID authentication.
 */
export class WebPushProvider implements ProviderAdapter {
  /**
   * Create a new Web Push provider
   * @param config - VAPID configuration
   */
  constructor(config: WebPushProviderConfig) {
    // Configure web-push library with VAPID details
    webPush.setVapidDetails(
      config.vapidSubject,
      config.vapidPublicKey,
      config.vapidPrivateKey
    );
  }

  /**
   * Get the name of this provider
   * @returns "web-push"
   */
  getName(): string {
    return 'web-push';
  }

  /**
   * Send a notification to a subscription
   * 
   * Maps HTTP status codes to ProviderResult:
   * - 201: Success
   * - 410: Subscription expired (no retry)
   * - 429: Rate limited (retry with backoff)
   * - 5xx: Server error (retry with backoff)
   * - 4xx (other): Client error (no retry)
   * 
   * @param subscription - Target subscription
   * @param payload - Notification payload
   * @param options - Send options (TTL, urgency, topic)
   * @returns Result of the send operation
   */
  async send(
    subscription: Subscription,
    payload: NotificationPayload,
    options: SendOptions
  ): Promise<ProviderResult> {
    try {
      // Convert subscription to web-push format
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      };

      // Convert payload to JSON string
      const payloadString = JSON.stringify(payload);

      // Build web-push options
      const webPushOptions: webPush.RequestOptions = {};

      // Set TTL (time-to-live) if provided
      if (options.ttl !== undefined) {
        webPushOptions.TTL = options.ttl;
      }

      // Set urgency if provided
      if (options.urgency) {
        webPushOptions.urgency = options.urgency;
      }

      // Set topic if provided
      if (options.topic) {
        webPushOptions.topic = options.topic;
      }

      // Send the notification
      const response = await webPush.sendNotification(
        pushSubscription,
        payloadString,
        webPushOptions
      );

      // Success - 201 Created
      return {
        success: true,
        statusCode: response.statusCode,
        shouldRetry: false,
      };
    } catch (error: any) {
      // Extract status code from error
      const statusCode = error.statusCode || error.status;

      // Extract Retry-After header if present
      let retryAfter: number | undefined;
      if (error.headers && error.headers['retry-after']) {
        const retryAfterValue = error.headers['retry-after'];
        // Retry-After can be in seconds (number) or HTTP date
        if (typeof retryAfterValue === 'string') {
          const parsed = parseInt(retryAfterValue, 10);
          if (!isNaN(parsed)) {
            retryAfter = parsed;
          }
        } else if (typeof retryAfterValue === 'number') {
          retryAfter = retryAfterValue;
        }
      }

      // Map status codes to retry decisions
      return this.mapErrorToResult(error, statusCode, retryAfter);
    }
  }

  /**
   * Map HTTP error to ProviderResult with appropriate retry decision
   * 
   * @param error - The error object
   * @param statusCode - HTTP status code
   * @param retryAfter - Retry-After header value in seconds
   * @returns ProviderResult with retry decision
   */
  private mapErrorToResult(
    error: any,
    statusCode: number | undefined,
    retryAfter: number | undefined
  ): ProviderResult {
    // 410 Gone - Subscription expired, no retry
    if (statusCode === 410) {
      return {
        success: false,
        statusCode,
        error: new Error('Subscription expired (410 Gone)'),
        shouldRetry: false,
      };
    }

    // 429 Too Many Requests - Rate limited, should retry
    if (statusCode === 429) {
      return {
        success: false,
        statusCode,
        error: new Error('Rate limited (429 Too Many Requests)'),
        shouldRetry: true,
        retryAfter,
      };
    }

    // 5xx Server errors - Should retry
    if (statusCode && statusCode >= 500 && statusCode < 600) {
      return {
        success: false,
        statusCode,
        error: new Error(`Server error (${statusCode}): ${error.message || 'Unknown error'}`),
        shouldRetry: true,
        retryAfter,
      };
    }

    // 4xx Client errors (other than 410 and 429) - No retry
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return {
        success: false,
        statusCode,
        error: new Error(`Client error (${statusCode}): ${error.message || 'Unknown error'}`),
        shouldRetry: false,
      };
    }

    // Network errors or unknown errors - Should retry
    return {
      success: false,
      statusCode,
      error: error instanceof Error ? error : new Error(String(error)),
      shouldRetry: true,
    };
  }
}
