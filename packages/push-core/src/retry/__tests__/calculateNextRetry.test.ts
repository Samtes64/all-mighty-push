/**
 * Tests for calculateNextRetry function
 */

import { calculateNextRetry } from '../calculateNextRetry';
import type { RetryPolicy } from '../../types/configuration';

describe('calculateNextRetry', () => {
  const defaultPolicy: RetryPolicy = {
    maxRetries: 8,
    baseDelay: 1000,
    backoffFactor: 2,
    maxDelay: 3600000, // 1 hour
    jitter: false,
  };

  describe('Exponential backoff', () => {
    it('should calculate delay using exponential backoff formula', () => {
      const policy = { ...defaultPolicy };

      // Attempt 0: 1000 * 2^0 = 1000ms
      const now0 = Date.now();
      const retry0 = calculateNextRetry(0, policy);
      expect(retry0.getTime()).toBeGreaterThanOrEqual(now0 + 999);
      expect(retry0.getTime()).toBeLessThan(now0 + 1100);

      // Attempt 1: 1000 * 2^1 = 2000ms
      const now1 = Date.now();
      const retry1 = calculateNextRetry(1, policy);
      expect(retry1.getTime()).toBeGreaterThanOrEqual(now1 + 1999);
      expect(retry1.getTime()).toBeLessThan(now1 + 2100);

      // Attempt 2: 1000 * 2^2 = 4000ms
      const now2 = Date.now();
      const retry2 = calculateNextRetry(2, policy);
      expect(retry2.getTime()).toBeGreaterThanOrEqual(now2 + 3999);
      expect(retry2.getTime()).toBeLessThan(now2 + 4100);

      // Attempt 3: 1000 * 2^3 = 8000ms
      const now3 = Date.now();
      const retry3 = calculateNextRetry(3, policy);
      expect(retry3.getTime()).toBeGreaterThanOrEqual(now3 + 7999);
      expect(retry3.getTime()).toBeLessThan(now3 + 8100);
    });

    it('should respect maxDelay cap', () => {
      const policy: RetryPolicy = {
        ...defaultPolicy,
        maxDelay: 5000, // Cap at 5 seconds
      };

      // Attempt 10 would be 1000 * 2^10 = 1,024,000ms, but capped at 5000ms
      const now = Date.now();
      const retry = calculateNextRetry(10, policy);
      expect(retry.getTime()).toBeGreaterThanOrEqual(now + 4999);
      expect(retry.getTime()).toBeLessThan(now + 5100);
    });

    it('should handle different base delays', () => {
      const policy: RetryPolicy = {
        ...defaultPolicy,
        baseDelay: 500,
      };

      // Attempt 0: 500 * 2^0 = 500ms
      const now = Date.now();
      const retry = calculateNextRetry(0, policy);
      expect(retry.getTime()).toBeGreaterThanOrEqual(now + 499);
      expect(retry.getTime()).toBeLessThan(now + 600);
    });

    it('should handle different backoff factors', () => {
      const policy: RetryPolicy = {
        ...defaultPolicy,
        backoffFactor: 3,
      };

      // Attempt 2: 1000 * 3^2 = 9000ms
      const now = Date.now();
      const retry = calculateNextRetry(2, policy);
      expect(retry.getTime()).toBeGreaterThanOrEqual(now + 8999);
      expect(retry.getTime()).toBeLessThan(now + 9100);
    });
  });

  describe('Jitter', () => {
    it('should apply jitter when enabled', () => {
      const policy: RetryPolicy = {
        ...defaultPolicy,
        jitter: true,
      };

      // Run multiple times to verify jitter adds randomness
      const delays: number[] = [];
      for (let i = 0; i < 10; i++) {
        const retry = calculateNextRetry(1, policy);
        const delay = retry.getTime() - Date.now();
        delays.push(delay);
      }

      // With jitter, delays should vary (not all the same)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);

      // All delays should be within ±25% of base delay (2000ms for attempt 1)
      const baseDelay = 2000;
      const minDelay = baseDelay * 0.75;
      const maxDelay = baseDelay * 1.25;

      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(minDelay);
        expect(delay).toBeLessThanOrEqual(maxDelay);
      });
    });

    it('should not apply jitter when disabled', () => {
      const policy: RetryPolicy = {
        ...defaultPolicy,
        jitter: false,
      };

      // Run multiple times to verify no jitter
      const delays: number[] = [];
      for (let i = 0; i < 5; i++) {
        const retry = calculateNextRetry(1, policy);
        const delay = Math.floor((retry.getTime() - Date.now()) / 100) * 100; // Round to 100ms
        delays.push(delay);
      }

      // Without jitter, all delays should be approximately the same
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeLessThanOrEqual(2); // Allow for timing variations
    });

    it('should never produce negative delays with jitter', () => {
      const policy: RetryPolicy = {
        ...defaultPolicy,
        baseDelay: 100,
        jitter: true,
      };

      // Run many times to ensure no negative delays
      for (let i = 0; i < 100; i++) {
        const retry = calculateNextRetry(0, policy);
        expect(retry.getTime()).toBeGreaterThanOrEqual(Date.now());
      }
    });
  });

  describe('Retry-After override', () => {
    it('should use Retry-After value when provided', () => {
      const policy = { ...defaultPolicy };
      const retryAfter = 30; // 30 seconds

      const now = Date.now();
      const retry = calculateNextRetry(0, policy, retryAfter);

      // Should be 30 seconds from now (30000ms)
      expect(retry.getTime()).toBeGreaterThanOrEqual(now + 29999);
      expect(retry.getTime()).toBeLessThan(now + 30100);
    });

    it('should ignore exponential backoff when Retry-After is provided', () => {
      const policy = { ...defaultPolicy };
      const retryAfter = 5; // 5 seconds

      // Even on attempt 10 (which would normally be very long), use Retry-After
      const now = Date.now();
      const retry = calculateNextRetry(10, policy, retryAfter);

      expect(retry.getTime()).toBeGreaterThanOrEqual(now + 4999);
      expect(retry.getTime()).toBeLessThan(now + 5100);
    });

    it('should ignore jitter when Retry-After is provided', () => {
      const policy: RetryPolicy = {
        ...defaultPolicy,
        jitter: true,
      };
      const retryAfter = 10;

      // Run multiple times - should all be the same (no jitter)
      const delays: number[] = [];
      for (let i = 0; i < 5; i++) {
        const retry = calculateNextRetry(0, policy, retryAfter);
        const delay = Math.floor((retry.getTime() - Date.now()) / 100) * 100;
        delays.push(delay);
      }

      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeLessThanOrEqual(2); // All approximately the same
    });

    it('should handle zero Retry-After', () => {
      const policy = { ...defaultPolicy };
      const retryAfter = 0;

      const now = Date.now();
      const retry = calculateNextRetry(0, policy, retryAfter);

      // Should use exponential backoff when Retry-After is 0
      expect(retry.getTime()).toBeGreaterThanOrEqual(now + 999);
    });
  });

  describe('Edge cases', () => {
    it('should handle attempt 0', () => {
      const policy = { ...defaultPolicy };

      const now = Date.now();
      const retry = calculateNextRetry(0, policy);

      // Attempt 0: baseDelay * backoffFactor^0 = baseDelay * 1 = baseDelay
      expect(retry.getTime()).toBeGreaterThanOrEqual(now + 999);
      expect(retry.getTime()).toBeLessThan(now + 1100);
    });

    it('should handle large attempt numbers', () => {
      const policy = { ...defaultPolicy };

      const now = Date.now();
      const retry = calculateNextRetry(100, policy);

      // Should be capped at maxDelay
      expect(retry.getTime()).toBeGreaterThanOrEqual(now + policy.maxDelay - 1);
      expect(retry.getTime()).toBeLessThan(now + policy.maxDelay + 100);
    });

    it('should return Date object', () => {
      const policy = { ...defaultPolicy };

      const retry = calculateNextRetry(0, policy);

      expect(retry).toBeInstanceOf(Date);
    });

    it('should return future date', () => {
      const policy = { ...defaultPolicy };

      const retry = calculateNextRetry(0, policy);

      expect(retry.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
