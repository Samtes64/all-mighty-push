/**
 * Circuit Breaker implementation to prevent cascading failures
 */

import { CircuitBreakerOpenError } from '../types/errors';
import type { CircuitBreakerConfig } from '../types/configuration';

/**
 * Circuit breaker states
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenMaxAttempts: 3,
};

/**
 * Circuit Breaker to prevent cascading failures
 * 
 * States:
 * - Closed: Normal operation, requests pass through
 * - Open: Failure threshold exceeded, requests rejected immediately
 * - Half-Open: Testing recovery, limited requests allowed
 * 
 * **Validates: Requirements 8.1, 8.2, 8.4, 8.5**
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: Date;
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function with circuit breaker protection
   * 
   * @param fn - Function to execute
   * @returns Result of the function
   * @throws {CircuitBreakerOpenError} If circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should attempt reset from open to half-open
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
        this.successCount = 0;
      } else {
        throw new CircuitBreakerOpenError('Circuit breaker is open', {
          state: this.state,
          failureCount: this.failureCount,
          lastFailureTime: this.lastFailureTime,
        });
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get the current state of the circuit breaker
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get the current failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      
      // If we've had enough successful attempts in half-open, close the circuit
      if (this.successCount >= this.config.halfOpenMaxAttempts) {
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = undefined;
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    // If we've exceeded the failure threshold, open the circuit
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      this.successCount = 0;
    }
  }

  /**
   * Check if enough time has passed to attempt reset from open to half-open
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return false;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.resetTimeout;
  }
}
