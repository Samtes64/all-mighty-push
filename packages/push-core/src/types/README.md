# Push Notification Core Types

This directory contains all the core TypeScript interfaces, types, and error classes for the push notification library.

## Files

### `subscription.ts`
- **SubscriptionStatus**: Type for subscription status ('active' | 'blocked' | 'expired')
- **SubscriptionKeys**: Interface for encryption keys (p256dh and auth)
- **Subscription**: Complete subscription record with all fields
- **CreateSubscriptionData**: Data required to create a new subscription
- **SubscriptionFilter**: Filter criteria for querying subscriptions

### `notification.ts`
- **NotificationAction**: Interface for notification action buttons
- **NotificationPayload**: Complete notification payload structure
- **SendOptions**: Options for sending notifications (TTL, urgency, topic)

### `results.ts`
- **ProviderResult**: Result from a provider send operation
- **SendResult**: Result from a single notification send
- **BatchResult**: Result from a batch send operation
- **RetryEntry**: Entry in the retry queue
- **QueueStats**: Statistics about the retry queue

### `adapters.ts`
- **StorageAdapter**: Interface for storage implementations (subscriptions and retry queue)
- **ProviderAdapter**: Interface for notification provider implementations
- **MetricsAdapter**: Interface for metrics collection
- **RateLimiter**: Interface for rate limiting implementations

### `configuration.ts`
- **VapidKeys**: VAPID credentials structure
- **RetryPolicy**: Retry policy configuration
- **CircuitBreakerConfig**: Circuit breaker configuration
- **BatchConfig**: Batch processing configuration
- **WorkerOptions**: Worker process configuration
- **LifecycleHooks**: Lifecycle hooks for observability
- **PushConfiguration**: Main configuration interface
- **DEFAULT_RETRY_POLICY**: Default retry policy values
- **DEFAULT_CIRCUIT_BREAKER_CONFIG**: Default circuit breaker configuration
- **DEFAULT_BATCH_CONFIG**: Default batch configuration
- **DEFAULT_WORKER_OPTIONS**: Default worker options

### `errors.ts`
- **PushError**: Base error class for all push notification errors
- **ConfigurationError**: Error for invalid or missing configuration
- **ValidationError**: Error for input validation failures
- **ProviderError**: Error for provider operation failures
- **StorageError**: Error for storage operation failures
- **CircuitBreakerOpenError**: Error when circuit breaker is open
- **RateLimitError**: Error when rate limits are exceeded

## Usage

All types are re-exported from the main package index:

```typescript
import {
  Subscription,
  NotificationPayload,
  StorageAdapter,
  PushConfiguration,
  ConfigurationError,
  // ... etc
} from '@allmightypush/push-core';
```

## Design Principles

1. **Type Safety**: All interfaces use strict TypeScript types with no `any`
2. **Documentation**: All types include JSDoc comments explaining their purpose
3. **Modularity**: Types are organized by domain (subscription, notification, adapters, etc.)
4. **Extensibility**: Interfaces support optional fields and metadata for customization
5. **Error Hierarchy**: Errors follow a clear inheritance chain for proper error handling

## Validation

The types are validated through:
- TypeScript strict mode compilation
- Unit tests verifying type exports and error classes
- Build verification for CJS, ESM, and type definitions
- ESLint and Prettier for code quality
