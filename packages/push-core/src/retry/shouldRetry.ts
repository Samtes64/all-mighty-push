/**
 * Retry decision logic
 */

import type { ProviderResult } from '../types/results';

/**
 * Determine if a failed notification should be retried
 * 
 * Retry conditions:
 * - Attempt count is below maxRetries
 * - Provider indicates shouldRetry is true
 * - Status code is 5xx (server error) or 429 (rate limited)
 * 
 * @param result - Result from provider send attempt
 * @param attempt - Current attempt number (0-indexed)
 * @param maxRetries - Maximum number of retry attempts allowed
 * @returns true if the notification should be retried, false otherwise
 * 
 * **Validates: Requirements 6.1, 6.5**
 */
export function shouldRetry(
  result: ProviderResult,
  attempt: number,
  maxRetries: number
): boolean {
  // Don't retry if we've exceeded max attempts
  if (attempt >= maxRetries) {
    return false;
  }

  // Don't retry if provider explicitly says not to
  if (!result.shouldRetry) {
    return false;
  }

  // Retry on 5xx server errors
  if (result.statusCode && result.statusCode >= 500 && result.statusCode < 600) {
    return true;
  }

  // Retry on 429 rate limit
  if (result.statusCode === 429) {
    return true;
  }

  // For other cases, trust the provider's shouldRetry flag
  return result.shouldRetry;
}
