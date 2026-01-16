/**
 * Token Bucket Rate Limiter implementation
 */

import type { RateLimiter } from '../types/adapters';

/**
 * Token Bucket Rate Limiter
 * 
 * Implements the token bucket algorithm for rate limiting.
 * Tokens are added to the bucket at a constant rate (refillRate).
 * Each request consumes tokens from the bucket.
 * 
 * **Validates: Requirements 9.4, 9.5**
 */
export class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private lastRefill: Date;

  /**
   * Create a new Token Bucket Rate Limiter
   * 
   * @param capacity - Maximum number of tokens in the bucket
   * @param refillRate - Number of tokens added per second
   */
  constructor(
    private capacity: number,
    private refillRate: number
  ) {
    this.tokens = capacity;
    this.lastRefill = new Date();
  }

  /**
   * Acquire tokens (blocking)
   * 
   * Waits until enough tokens are available, then consumes them.
   * 
   * @param tokens - Number of tokens to acquire (default: 1)
   */
  async acquire(tokens: number = 1): Promise<void> {
    this.refill();

    // Wait until we have enough tokens
    while (this.tokens < tokens) {
      await this.sleep(100); // Check every 100ms
      this.refill();
    }

    // Consume the tokens
    this.tokens -= tokens;
  }

  /**
   * Try to acquire tokens (non-blocking)
   * 
   * Returns true if tokens were acquired, false otherwise.
   * 
   * @param tokens - Number of tokens to acquire (default: 1)
   * @returns true if tokens were acquired, false otherwise
   */
  tryAcquire(tokens: number = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Get the number of available tokens
   * 
   * @returns Number of tokens currently available
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = new Date();
    const elapsed = (now.getTime() - this.lastRefill.getTime()) / 1000; // seconds

    // Calculate tokens to add based on elapsed time and refill rate
    const tokensToAdd = elapsed * this.refillRate;

    // Add tokens, but don't exceed capacity
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);

    // Update last refill time
    this.lastRefill = now;
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
