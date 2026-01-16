# @allmightypush/push

> Modular, TypeScript-first push notification library for Node.js with Web Push (VAPID) support

## Features

- 🚀 **Production-ready** - Comprehensive error handling and retry logic
- 📦 **Modular** - Use only what you need with pluggable adapters
- 🔒 **Type-safe** - Full TypeScript support with strict mode
- ⚡ **Reliable** - Circuit breaker, rate limiting, and exponential backoff
- 🔄 **Automatic retries** - Background worker for failed notifications
- 🎯 **Batch sending** - Efficient bulk notification delivery
- 📊 **Observable** - Lifecycle hooks and metrics integration
- 🛡️ **Graceful shutdown** - No data loss on termination

## Installation

```bash
npm install @allmightypush/push
```

This meta-package includes:
- `@allmightypush/push-core` - Core runtime engine
- `@allmightypush/push-webpush` - Web Push (VAPID) provider
- `@allmightypush/push-storage-sqlite` - SQLite storage adapter

## Quick Start

```typescript
import { PushCore, RetryWorker, SQLiteStorageAdapter, WebPushProvider } from '@allmightypush/push';

// 1. Configure the push system
const pushCore = new PushCore();
const storage = new SQLiteStorageAdapter({ filename: './push.db' });

pushCore.configure({
  vapidKeys: {
    publicKey: 'your-vapid-public-key',
    privateKey: 'your-vapid-private-key',
    subject: 'mailto:admin@example.com',
  },
  storageAdapter: storage,
});

// 2. Create a subscription
const subscription = await storage.createSubscription({
  endpoint: 'https://fcm.googleapis.com/fcm/send/...',
  keys: {
    p256dh: 'user-public-key',
    auth: 'user-auth-secret',
  },
  status: 'active',
});

// 3. Send a notification
const result = await pushCore.sendNotification(subscription, {
  title: 'Hello!',
  body: 'This is a push notification',
  icon: '/icon.png',
  data: { url: '/news/article-1' },
});

console.log('Notification sent:', result.success);

// 4. Start worker for retry processing (optional)
const worker = new RetryWorker(
  storage,
  new WebPushProvider({
    vapidPublicKey: 'your-vapid-public-key',
    vapidPrivateKey: 'your-vapid-private-key',
    vapidSubject: 'mailto:admin@example.com',
  }),
  {
    maxRetries: 8,
    baseDelay: 1000,
    backoffFactor: 2,
    maxDelay: 3600000,
    jitter: true,
  }
);

await worker.start();

// 5. Graceful shutdown
process.on('SIGTERM', async () => {
  await worker.stop();
  await pushCore.shutdown();
  process.exit(0);
});
```

## Batch Sending

```typescript
const subscriptions = await storage.findSubscriptions({ status: 'active' });

const result = await pushCore.batchSend(subscriptions, {
  title: 'Breaking News',
  body: 'Important update for all users',
});

console.log(`Sent to ${result.success}/${result.total} subscriptions`);
console.log(`Failed: ${result.failed}, Retried: ${result.retried}`);
```

## Advanced Configuration

```typescript
pushCore.configure({
  vapidKeys: {
    publicKey: process.env.VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!,
    subject: 'mailto:admin@example.com',
  },
  storageAdapter: storage,
  
  // Retry policy
  retryPolicy: {
    maxRetries: 8,
    baseDelay: 1000,
    backoffFactor: 2,
    maxDelay: 3600000,
    jitter: true,
  },
  
  // Circuit breaker
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 60000,
    halfOpenMaxAttempts: 3,
  },
  
  // Batch configuration
  batchConfig: {
    batchSize: 50,
    concurrency: 10,
  },
  
  // Lifecycle hooks
  lifecycleHooks: {
    onSend: async (subscription, payload) => {
      console.log('Sending to:', subscription.id);
    },
    onSuccess: async (subscription, result) => {
      console.log('Success:', subscription.id);
    },
    onFailure: async (subscription, error) => {
      console.error('Failed:', subscription.id, error);
    },
    onRetry: async (subscription, attempt) => {
      console.log('Retry attempt:', attempt, 'for:', subscription.id);
    },
  },
});
```

## Generating VAPID Keys

```typescript
import { generateVapidKeys } from '@allmightypush/push';

const vapidKeys = generateVapidKeys();
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);

// Save these keys securely - you'll need them for all notifications
```

## Storage Adapters

### SQLite (included)
```typescript
import { SQLiteStorageAdapter } from '@allmightypush/push';

const storage = new SQLiteStorageAdapter({
  filename: './push.db',
});
```

### PostgreSQL (separate package)
```bash
npm install @allmightypush/push-storage-postgres
```

### MongoDB (separate package)
```bash
npm install @allmightypush/push-storage-mongo
```

## API Reference

### PushCore

#### `configure(options: PushConfiguration): void`
Configure the push notification system.

#### `sendNotification(subscription: Subscription, payload: NotificationPayload, options?: SendOptions): Promise<SendResult>`
Send a notification to a single subscription.

#### `batchSend(subscriptions: Subscription[], payload: NotificationPayload, options?: SendOptions): Promise<BatchResult>`
Send notifications to multiple subscriptions efficiently.

#### `verifySubscription(subscription: Subscription): Promise<void>`
Verify that a subscription is valid.

#### `shutdown(timeout?: number): Promise<void>`
Gracefully shutdown the system.

### RetryWorker

#### `start(): Promise<void>`
Start the worker polling loop.

#### `stop(): Promise<void>`
Stop the worker gracefully.

#### `isRunning(): boolean`
Check if the worker is running.

## Error Handling

The library provides typed errors for different scenarios:

```typescript
import { 
  ConfigurationError,
  ValidationError,
  ProviderError,
  StorageError,
  CircuitBreakerOpenError,
  RateLimitError
} from '@allmightypush/push';

try {
  await pushCore.sendNotification(subscription, payload);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid subscription:', error.message);
  } else if (error instanceof CircuitBreakerOpenError) {
    console.error('Circuit breaker is open, try again later');
  } else if (error instanceof ProviderError) {
    console.error('Provider error:', error.statusCode);
  }
}
```

## Testing

The library includes 230+ tests with ~90% coverage:

```bash
npm test
```

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines first.

## Support

- 📖 [Documentation](https://github.com/samtes64/all-mighty-push)
- 🐛 [Issue Tracker](https://github.com/samtes64/all-mighty-push/issues)
- 💬 [Discussions](https://github.com/samtes64/all-mighty-push/discussions)
