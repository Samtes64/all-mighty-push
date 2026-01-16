/**
 * Tests for type exports and basic type checking
 */

import {
  // Subscription types
  Subscription,
  SubscriptionStatus,
  // Notification types
  NotificationPayload,
  SendOptions,
  // Result types
  RetryEntry,
  // Configuration types
  DEFAULT_RETRY_POLICY,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_BATCH_CONFIG,
  DEFAULT_WORKER_OPTIONS,
  // Error classes
  PushError,
  ConfigurationError,
  ValidationError,
  ProviderError,
  StorageError,
  CircuitBreakerOpenError,
  RateLimitError,
} from '../index';

describe('Type Exports', () => {
  it('should export all subscription types', () => {
    expect(typeof 'active' as SubscriptionStatus).toBe('string');
    expect(typeof 'blocked' as SubscriptionStatus).toBe('string');
    expect(typeof 'expired' as SubscriptionStatus).toBe('string');
  });

  it('should export default configuration values', () => {
    expect(DEFAULT_RETRY_POLICY).toBeDefined();
    expect(DEFAULT_RETRY_POLICY.maxRetries).toBe(8);
    expect(DEFAULT_RETRY_POLICY.baseDelay).toBe(1000);
    expect(DEFAULT_RETRY_POLICY.backoffFactor).toBe(2);
    expect(DEFAULT_RETRY_POLICY.maxDelay).toBe(3600000);
    expect(DEFAULT_RETRY_POLICY.jitter).toBe(true);
  });

  it('should export default circuit breaker config', () => {
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG).toBeDefined();
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold).toBe(5);
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeout).toBe(60000);
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.halfOpenMaxAttempts).toBe(3);
  });

  it('should export default batch config', () => {
    expect(DEFAULT_BATCH_CONFIG).toBeDefined();
    expect(DEFAULT_BATCH_CONFIG.batchSize).toBe(50);
    expect(DEFAULT_BATCH_CONFIG.concurrency).toBe(10);
  });

  it('should export default worker options', () => {
    expect(DEFAULT_WORKER_OPTIONS).toBeDefined();
    expect(DEFAULT_WORKER_OPTIONS.pollInterval).toBe(5000);
    expect(DEFAULT_WORKER_OPTIONS.concurrency).toBe(10);
    expect(DEFAULT_WORKER_OPTIONS.batchSize).toBe(50);
    expect(DEFAULT_WORKER_OPTIONS.errorBackoff).toBe(10000);
  });
});

describe('Error Classes', () => {
  it('should create PushError with code and details', () => {
    const error = new PushError('Test error', 'TEST_CODE', { key: 'value' });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PushError);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ key: 'value' });
    expect(error.name).toBe('PushError');
  });

  it('should create ConfigurationError', () => {
    const error = new ConfigurationError('Config error');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PushError);
    expect(error).toBeInstanceOf(ConfigurationError);
    expect(error.message).toBe('Config error');
    expect(error.code).toBe('CONFIGURATION_ERROR');
    expect(error.name).toBe('ConfigurationError');
  });

  it('should create ValidationError', () => {
    const error = new ValidationError('Validation failed');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PushError);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Validation failed');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.name).toBe('ValidationError');
  });

  it('should create ProviderError with status code and retry flag', () => {
    const error = new ProviderError('Provider failed', 500, true, {
      endpoint: 'https://example.com',
    });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PushError);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.message).toBe('Provider failed');
    expect(error.code).toBe('PROVIDER_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.shouldRetry).toBe(true);
    expect(error.details).toEqual({ endpoint: 'https://example.com' });
    expect(error.name).toBe('ProviderError');
  });

  it('should create StorageError', () => {
    const error = new StorageError('Storage failed');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PushError);
    expect(error).toBeInstanceOf(StorageError);
    expect(error.message).toBe('Storage failed');
    expect(error.code).toBe('STORAGE_ERROR');
    expect(error.name).toBe('StorageError');
  });

  it('should create CircuitBreakerOpenError with default message', () => {
    const error = new CircuitBreakerOpenError();
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PushError);
    expect(error).toBeInstanceOf(CircuitBreakerOpenError);
    expect(error.message).toBe('Circuit breaker is open');
    expect(error.code).toBe('CIRCUIT_BREAKER_OPEN');
    expect(error.name).toBe('CircuitBreakerOpenError');
  });

  it('should create CircuitBreakerOpenError with custom message', () => {
    const error = new CircuitBreakerOpenError('Custom message');
    expect(error.message).toBe('Custom message');
  });

  it('should create RateLimitError with retry after', () => {
    const error = new RateLimitError('Rate limited', 60);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PushError);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.message).toBe('Rate limited');
    expect(error.code).toBe('RATE_LIMIT_ERROR');
    expect(error.retryAfter).toBe(60);
    expect(error.name).toBe('RateLimitError');
  });

  it('should maintain proper error inheritance chain', () => {
    const errors = [
      new ConfigurationError('test'),
      new ValidationError('test'),
      new ProviderError('test'),
      new StorageError('test'),
      new CircuitBreakerOpenError(),
      new RateLimitError('test'),
    ];

    errors.forEach((error) => {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PushError);
      expect(error.stack).toBeDefined();
    });
  });
});

describe('Type Validation', () => {
  it('should validate SubscriptionStatus values', () => {
    const validStatuses: SubscriptionStatus[] = ['active', 'blocked', 'expired'];
    expect(validStatuses).toHaveLength(3);
  });

  it('should validate SendOptions urgency values', () => {
    const validUrgencies: Array<SendOptions['urgency']> = ['very-low', 'low', 'normal', 'high'];
    expect(validUrgencies).toHaveLength(4);
  });

  it('should allow creating a minimal subscription object', () => {
    const subscription: Subscription = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      endpoint: 'https://push.example.com/endpoint',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      failedCount: 0,
      status: 'active',
    };
    expect(subscription).toBeDefined();
  });

  it('should allow creating a minimal notification payload', () => {
    const payload: NotificationPayload = {
      title: 'Test Notification',
      body: 'This is a test',
    };
    expect(payload).toBeDefined();
  });

  it('should allow creating a retry entry', () => {
    const retry: RetryEntry = {
      id: '123e4567-e89b-12d3-a456-426614174001',
      subscriptionId: '123e4567-e89b-12d3-a456-426614174000',
      payload: {
        title: 'Test',
        body: 'Test body',
      },
      attempt: 0,
      nextRetryAt: new Date(),
      createdAt: new Date(),
    };
    expect(retry).toBeDefined();
  });
});
