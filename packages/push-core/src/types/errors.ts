/**
 * Error class hierarchy for the push notification library
 */

/**
 * Base error class for all push notification errors
 */
export class PushError extends Error {
  /**
   * Create a new PushError
   * @param message - Error message
   * @param code - Error code for programmatic handling
   * @param details - Optional additional error details
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when configuration is invalid or missing
 */
export class ConfigurationError extends PushError {
  /**
   * Create a new ConfigurationError
   * @param message - Error message
   * @param details - Optional additional error details
   */
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', details);
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends PushError {
  /**
   * Create a new ValidationError
   * @param message - Error message
   * @param details - Optional additional error details
   */
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

/**
 * Error thrown when a provider operation fails
 */
export class ProviderError extends PushError {
  /**
   * Create a new ProviderError
   * @param message - Error message
   * @param statusCode - HTTP status code (if applicable)
   * @param shouldRetry - Whether the operation should be retried
   * @param details - Optional additional error details
   */
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly shouldRetry: boolean = false,
    details?: Record<string, unknown>
  ) {
    super(message, 'PROVIDER_ERROR', details);
  }
}

/**
 * Error thrown when a storage operation fails
 */
export class StorageError extends PushError {
  /**
   * Create a new StorageError
   * @param message - Error message
   * @param details - Optional additional error details
   */
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STORAGE_ERROR', details);
  }
}

/**
 * Error thrown when the circuit breaker is open
 */
export class CircuitBreakerOpenError extends PushError {
  /**
   * Create a new CircuitBreakerOpenError
   * @param message - Error message (defaults to standard message)
   * @param details - Optional additional error details
   */
  constructor(message: string = 'Circuit breaker is open', details?: Record<string, unknown>) {
    super(message, 'CIRCUIT_BREAKER_OPEN', details);
  }
}

/**
 * Error thrown when rate limits are exceeded
 */
export class RateLimitError extends PushError {
  /**
   * Create a new RateLimitError
   * @param message - Error message
   * @param retryAfter - Seconds to wait before retrying (from Retry-After header)
   * @param details - Optional additional error details
   */
  constructor(
    message: string,
    public readonly retryAfter?: number,
    details?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT_ERROR', details);
  }
}
