# @allmightypush/push-webpush

Web Push (VAPID) provider adapter for the push notification library.

## Installation

```bash
npm install @allmightypush/push-webpush @allmightypush/push-core
```

## Usage

```typescript
import { WebPushProvider } from '@allmightypush/push-webpush';

// Create a Web Push provider with VAPID credentials
const provider = new WebPushProvider({
  vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY',
  vapidPrivateKey: 'YOUR_VAPID_PRIVATE_KEY',
  vapidSubject: 'mailto:your-email@example.com',
});

// Use with the push core runtime
import { PushCore } from '@allmightypush/push-core';

const pushCore = new PushCore();
pushCore.configure({
  providerAdapter: provider,
  // ... other configuration
});
```

## Features

- **VAPID Authentication**: Secure authentication using Voluntary Application Server Identification
- **Status Code Mapping**: Intelligent handling of HTTP status codes with appropriate retry decisions
- **Retry-After Support**: Respects `Retry-After` headers from push services
- **Full Options Support**: Supports TTL, urgency, and topic options

## Status Code Handling

The provider maps HTTP status codes to appropriate actions:

| Status Code | Description | Retry? |
|------------|-------------|--------|
| 201 | Success | No |
| 410 | Subscription expired | No |
| 429 | Rate limited | Yes (with backoff) |
| 5xx | Server error | Yes (with backoff) |
| 4xx (other) | Client error | No |

## Send Options

The provider supports the following send options:

- **ttl**: Time-to-live in seconds (how long the push service should queue the message)
- **urgency**: Priority hint for the push service (`'very-low'`, `'low'`, `'normal'`, `'high'`)
- **topic**: Topic for replacing previous notifications

Example:

```typescript
await pushCore.sendNotification(
  subscription,
  {
    title: 'Breaking News',
    body: 'Important update',
  },
  {
    ttl: 3600, // 1 hour
    urgency: 'high',
    topic: 'news-alerts',
  }
);
```

## VAPID Keys

To generate VAPID keys, you can use the web-push library:

```bash
npx web-push generate-vapid-keys
```

Or use the CLI tool from `@allmightypush/push-cli`:

```bash
npx @allmightypush/push-cli generate-keys
```

## Error Handling

The provider handles various error scenarios:

- **Network Errors**: Automatically retried
- **Expired Subscriptions (410)**: Marked as expired, not retried
- **Rate Limiting (429)**: Retried with exponential backoff, respects `Retry-After` header
- **Server Errors (5xx)**: Retried with exponential backoff
- **Client Errors (4xx)**: Not retried (except 429)

## TypeScript Support

This package is written in TypeScript and includes full type definitions.

## License

MIT
