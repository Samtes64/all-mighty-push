/**
 * Tests for CircuitBreaker
 */

import { CircuitBreaker } from '../CircuitBreaker';
import { CircuitBreakerOpenError } from '../../types/errors';

describe('CircuitBreaker', () => {
  describe('Initial state', () => {
    it('should start in closed state', () => {
      const cb = new CircuitBreaker();
      expect(cb.getState()).toBe('closed');
    });

    it('should start with zero failure count', () => {
      const cb = new CircuitBreaker();
      expect(cb.getFailureCount()).toBe(0);
    });
  });

  describe('Closed state behavior', () => {
    it('should allow requests to pass through', async () => {
      const cb = new CircuitBreaker();
      const fn = jest.fn().mockResolvedValue('success');

      const result = await cb.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset failure count on success', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });

      // Fail twice
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      expect(cb.getFailureCount()).toBe(2);

      // Succeed once
      await cb.execute(() => Promise.resolve('success'));
      expect(cb.getFailureCount()).toBe(0);
    });

    it('should transition to open when failure threshold is reached', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });

      // Fail 3 times
      await expect(cb.execute(() => Promise.reject(new Error('fail 1')))).rejects.toThrow();
      await expect(cb.execute(() => Promise.reject(new Error('fail 2')))).rejects.toThrow();
      await expect(cb.execute(() => Promise.reject(new Error('fail 3')))).rejects.toThrow();

      expect(cb.getState()).toBe('open');
    });
  });

  describe('Open state behavior', () => {
    it('should reject requests immediately without calling function', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });
      const fn = jest.fn().mockResolvedValue('success');

      // Fail twice to open circuit
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      expect(cb.getState()).toBe('open');

      // Next request should be rejected without calling fn
      await expect(cb.execute(fn)).rejects.toThrow(CircuitBreakerOpenError);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should throw CircuitBreakerOpenError with details', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });

      // Open the circuit
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      try {
        await cb.execute(() => Promise.resolve('success'));
        fail('Should have thrown CircuitBreakerOpenError');
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerOpenError);
        expect((error as CircuitBreakerOpenError).details?.state).toBe('open');
        expect((error as CircuitBreakerOpenError).details?.failureCount).toBeGreaterThan(0);
      }
    });

    it('should transition to half-open after reset timeout', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 100, // 100ms
      });

      // Open the circuit
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      expect(cb.getState()).toBe('open');

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next request should transition to half-open
      await cb.execute(() => Promise.resolve('success'));
      expect(cb.getState()).toBe('half-open');
    });
  });

  describe('Half-open state behavior', () => {
    it('should allow limited test requests', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 100,
        halfOpenMaxAttempts: 2,
      });

      // Open the circuit
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // First request transitions to half-open
      await cb.execute(() => Promise.resolve('success'));
      expect(cb.getState()).toBe('half-open');

      // Second successful request should still be in half-open
      await cb.execute(() => Promise.resolve('success'));
      expect(cb.getState()).toBe('closed'); // Closes after 2 successes
    });

    it('should transition to closed after enough successful attempts', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 100,
        halfOpenMaxAttempts: 3,
      });

      // Open the circuit
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Make 3 successful requests
      await cb.execute(() => Promise.resolve('success 1'));
      await cb.execute(() => Promise.resolve('success 2'));
      await cb.execute(() => Promise.resolve('success 3'));

      expect(cb.getState()).toBe('closed');
      expect(cb.getFailureCount()).toBe(0);
    });

    it('should transition back to open on failure', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 100,
        halfOpenMaxAttempts: 3,
      });

      // Open the circuit
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // First request succeeds (half-open)
      await cb.execute(() => Promise.resolve('success'));
      expect(cb.getState()).toBe('half-open');

      // Second request fails (back to open)
      await expect(cb.execute(() => Promise.reject(new Error('fail again')))).rejects.toThrow();
      expect(cb.getState()).toBe('open');
    });
  });

  describe('Configuration', () => {
    it('should use custom failure threshold', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 5 });

      // Fail 4 times - should still be closed
      for (let i = 0; i < 4; i++) {
        await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      }
      expect(cb.getState()).toBe('closed');

      // 5th failure should open
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      expect(cb.getState()).toBe('open');
    });

    it('should use custom reset timeout', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 200,
      });

      // Open the circuit
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Wait less than reset timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still be open
      await expect(cb.execute(() => Promise.resolve('success'))).rejects.toThrow(
        CircuitBreakerOpenError
      );

      // Wait for full reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should now transition to half-open
      await cb.execute(() => Promise.resolve('success'));
      expect(cb.getState()).toBe('half-open');
    });

    it('should use custom half-open max attempts', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 100,
        halfOpenMaxAttempts: 5,
      });

      // Open the circuit
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Make 4 successful requests - should still be half-open
      for (let i = 0; i < 4; i++) {
        await cb.execute(() => Promise.resolve('success'));
      }
      expect(cb.getState()).toBe('half-open');

      // 5th success should close
      await cb.execute(() => Promise.resolve('success'));
      expect(cb.getState()).toBe('closed');
    });
  });

  describe('reset() method', () => {
    it('should reset circuit to closed state', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });

      // Open the circuit
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      expect(cb.getState()).toBe('open');

      // Reset
      cb.reset();

      expect(cb.getState()).toBe('closed');
      expect(cb.getFailureCount()).toBe(0);
    });

    it('should allow requests after reset', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });

      // Open the circuit
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Reset
      cb.reset();

      // Should allow requests
      const result = await cb.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
    });
  });

  describe('Edge cases', () => {
    it('should handle synchronous errors', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });

      await expect(
        cb.execute(() => {
          throw new Error('sync error');
        })
      ).rejects.toThrow('sync error');

      expect(cb.getFailureCount()).toBe(1);
    });

    it('should handle async errors', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });

      await expect(cb.execute(() => Promise.reject(new Error('async error')))).rejects.toThrow(
        'async error'
      );

      expect(cb.getFailureCount()).toBe(1);
    });

    it('should handle zero failure threshold', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 0 });

      // Should immediately open on first failure
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      expect(cb.getState()).toBe('open');
    });
  });
});
