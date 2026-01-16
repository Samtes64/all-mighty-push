# Push Notification Library

> Production-ready, modular push notification system for Node.js with TypeScript support

[![Tests](https://img.shields.io/badge/tests-230%2B%20passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

## Overview

A comprehensive push notification library built with TypeScript that provides:

- 🚀 **Production-ready** core runtime with 230+ tests
- 📦 **Modular architecture** with pluggable adapters
- 🔒 **Type-safe** with full TypeScript support
- ⚡ **Reliable** with circuit breaker, rate limiting, and retry logic
- 🔄 **Automatic retries** via background worker
- 🎯 **Batch sending** with concurrency control
- 📊 **Observable** with lifecycle hooks and metrics
- 🛡️ **Graceful shutdown** support

## Quick Start

```bash
npm install @allmightypush/push
```

```typescript
import { PushCore, SQLiteStorageAdapter } from '@allmightypush/push';

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

// Send notification
const result = await pushCore.sendNotification(subscription, {
  title: 'Hello!',
  body: 'This is a push notification',
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Code                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      PushCore                                │
│  • Configuration Management                                  │
│  • Notification Sending (Single & Batch)                     │
│  • Retry Enqueuing                                          │
│  • Lifecycle Hooks                                          │
└─────┬──────────┬──────────┬──────────┬─────────────────────┘
      │          │          │          │
      ▼          ▼          ▼          ▼
┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
│ Storage  │ │Provider│ │Circuit │ │   Rate   │
│ Adapter  │ │Adapter │ │Breaker │ │ Limiter  │
└──────────┘ └────────┘ └────────┘ └──────────┘
      │          │
      ▼          ▼
┌──────────┐ ┌────────┐
│ SQLite/  │ │  Web   │
│Postgres/ │ │  Push  │
│ MongoDB  │ │ (VAPID)│
└──────────┘ └────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│                    RetryWorker                               │
│  • Background Polling                                        │
│  • Retry Processing                                          │
│  • Concurrency Control                                       │
└─────────────────────────────────────────────────────────────┘
```

## Packages

This monorepo contains the following packages:

### Core Packages

- **[@allmightypush/push](./packages/push)** - Meta-package with all core functionality
- **[@allmightypush/push-core](./packages/push-core)** - Core runtime engine (128 tests)
- **[@allmightypush/push-webpush](./packages/push-webpush)** - Web Push (VAPID) provider (21 tests)

### Storage Adapters

- **[@allmightypush/push-storage-sqlite](./packages/push-storage-sqlite)** - SQLite adapter (67 tests)
- **[@allmightypush/push-storage-postgres](./packages/push-storage-postgres)** - PostgreSQL adapter
- **[@allmightypush/push-storage-mongo](./packages/push-storage-mongo)** - MongoDB adapter

### Tools

- **[@allmightypush/push-cli](./packages/push-cli)** - Command-line interface

## Features

### Core Runtime Engine

- **Configuration Management** - Flexible configuration with sensible defaults
- **Single & Batch Sending** - Send to one or thousands of subscribers
- **Subscription Verification** - Validate subscription structure
- **Graceful Shutdown** - Clean termination without data loss

### Reliability

- **Exponential Backoff** - Automatic retry with jitter (±25%)
- **Circuit Breaker** - Prevent cascading failures
- **Rate Limiting** - Token bucket algorithm
- **Max Retries** - Configurable retry limits
- **Retry-After** - Respect server backoff headers

### Worker System

- **Background Processing** - Async retry queue processing
- **Concurrency Control** - Configurable parallel operations
- **Graceful Shutdown** - Wait for in-flight operations
- **Error Handling** - Automatic backoff on errors

### Observability

- **Lifecycle Hooks** - onSend, onSuccess, onFailure, onRetry
- **Metrics Integration** - Pluggable metrics adapter
- **Queue Statistics** - Monitor retry queue health
- **Detailed Errors** - Typed error classes with context

## Development

### Prerequisites

- Node.js >= 16.0.0
- npm >= 7.0.0

### Setup

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure

```
.
├── packages/
│   ├── push/                    # Meta-package
│   ├── push-core/              # Core runtime (2000+ lines, 128 tests)
│   │   ├── src/
│   │   │   ├── core/           # PushCore class
│   │   │   ├── worker/         # RetryWorker class
│   │   │   ├── circuit-breaker/
│   │   │   ├── rate-limiter/
│   │   │   ├── retry/          # Retry logic
│   │   │   ├── vapid/          # VAPID key management
│   │   │   └── types/          # TypeScript types
│   │   └── __tests__/          # Test suites
│   ├── push-webpush/           # Web Push provider (200+ lines, 21 tests)
│   ├── push-storage-sqlite/    # SQLite adapter (400+ lines, 67 tests)
│   ├── push-storage-postgres/  # PostgreSQL adapter
│   ├── push-storage-mongo/     # MongoDB adapter
│   └── push-cli/               # CLI tool
documents
│       └── all-mighty-push/
│           ├── requirements.md  # 20 requirements, 100 acceptance criteria
│           ├── design.md        # Architecture & design patterns
│           └── tasks.md         # 24 implementation tasks
└── README.md
```

## Testing

The library has comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests for specific package
npm test --workspace=@allmightypush/push-core

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Statistics

- **Total Tests**: 230+
- **Coverage**: ~90%
- **Test Suites**: 9
- **Test Types**: Unit, Integration, End-to-End

## Documentation


- [API Reference](./packages/push/README.md) - Complete API documentation

## Examples

### Basic Usage

```typescript
import { PushCore, SQLiteStorageAdapter } from '@allmightypush/push';

const pushCore = new PushCore();
pushCore.configure({
  vapidKeys: {
    publicKey: process.env.VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!,
  },
  storageAdapter: new SQLiteStorageAdapter({ filename: './push.db' }),
});

await pushCore.sendNotification(subscription, {
  title: 'Hello!',
  body: 'This is a notification',
});
```

### With Worker

```typescript
import { RetryWorker, WebPushProvider } from '@allmightypush/push';

const worker = new RetryWorker(
  storage,
  new WebPushProvider({ /* config */ }),
  { maxRetries: 8, baseDelay: 1000 }
);

await worker.start();
```

### Batch Sending

```typescript
const subscriptions = await storage.findSubscriptions({ status: 'active' });
const result = await pushCore.batchSend(subscriptions, {
  title: 'Breaking News',
  body: 'Important update',
});

console.log(`Success: ${result.success}/${result.total}`);
```

### With Lifecycle Hooks

```typescript
pushCore.configure({
  // ... other config
  lifecycleHooks: {
    onSend: async (sub, payload) => console.log('Sending...'),
    onSuccess: async (sub, result) => console.log('Success!'),
    onFailure: async (sub, error) => console.error('Failed:', error),
    onRetry: async (sub, attempt) => console.log(`Retry ${attempt}`),
  },
});
```

## Performance

- **Batch Processing**: 50 notifications per batch (configurable)
- **Concurrency**: 10 concurrent operations (configurable)
- **Rate Limiting**: Token bucket with configurable refill rate
- **Memory**: Efficient in-memory tracking of in-flight operations
- **Database**: Indexed queries for fast subscription lookup

## Production Deployment

### Environment Variables

```bash
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:admin@example.com
DATABASE_URL=./push.db
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await worker.stop();
  await pushCore.shutdown(30000); // 30 second timeout
  process.exit(0);
});
```

## Roadmap

- [x] Core runtime engine
- [x] SQLite storage adapter
- [x] Web Push provider
- [x] Retry logic with exponential backoff
- [x] Circuit breaker
- [x] Rate limiter
- [x] Worker process
- [x] Graceful shutdown
- [x] Comprehensive testing (230+ tests)
- [ ] Express middleware
- [ ] PostgreSQL adapter
- [ ] MongoDB adapter
- [ ] CLI tool
- [ ] Documentation site
- [ ] Demo application

## Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT © samtes64

## Acknowledgments

- Built with [TypeScript](https://www.typescriptlang.org/)
- Uses [web-push](https://github.com/web-push-libs/web-push) for VAPID
- Tested with [Jest](https://jestjs.io/)
- Inspired by best practices from production push notification systems

## Support

- 📖 [Documentation](https://github.com/samtes64/all-mighty-push)
- 🐛 [Issue Tracker](https://github.com/samtes64/all-mighty-push/issues)
- 💬 [Discussions](https://github.com/samtes64/all-mighty-push/discussions)
- 📧 Email: samtes64@gmail.com

---

Made with ❤️ by Samuel
