/**
 * Retry policy calculator with exponential backoff and jitter
 */

import type { RetryPolicy } from '../types/configuration';

/**
 * Calculate the next retry time using exponential backoff with optional jitter
 * 
 * Formula: delay = min(baseDelay × backoffFactor^attempt, maxDelay)
 * With jitter: delay ± 25% randomness
 * 
 * @param attempt - Current attempt number (0-indexed)
 * @param policy - Retry policy configuration
 * @param retryAfter - Optional Retry-After value in seconds (overrides calculation)
 * @returns Date object representing when to retry next
 * 
 * **Validates: Requirements 6.2, 6.4**
 */
export function calculateNextRetry(
  attempt: number,
  policy: RetryPolicy,
  retryAfter?: number
): Date {
  // If Retry-After is provided, use it directly (override exponential backoff)
  if (retryAfter !== undefined && retryAfter > 0) {
    return new Date(Date.now() + retryAfter * 1000);
  }

  const baseDelay = policy.baseDelay;
  const backoffFactor = policy.backoffFactor;
  const maxDelay = policy.maxDelay;
  const jitter = policy.jitter;

  // Calculate exponential backoff: baseDelay × backoffFactor^attempt
  let delay = baseDelay * Math.pow(backoffFactor, attempt);

  // Apply maxDelay cap
  delay = Math.min(delay, maxDelay);

  // Apply jitter if enabled (±25% of calculated delay)
  if (jitter) {
    const jitterAmount = delay * 0.25;
    // Random value between -1 and 1, multiplied by jitter amount
    const jitterOffset = (Math.random() * 2 - 1) * jitterAmount;
    delay = delay + jitterOffset;

    // Ensure delay is never negative
    delay = Math.max(0, delay);
  }

  // Return Date object for next retry time
  return new Date(Date.now() + delay);
}
