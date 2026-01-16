# Quick Start Guide

## Installation

```bash
npm install @allmightypush/push @allmightypush/push-storage-sqlite @allmightypush/push-webpush
```

## Basic Usage

### 1. Generate VAPID Keys

```typescript
import { generateVapidKeys } from '@allmightypush/push';

const vapidKeys = generateVapidKeys();
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);
```

Or use CLI:

```bash
npx @allmightypush/push-cli generate-keys
```

### 2. Setup Storage and Provider

```typescript
import { PushCore, RetryWorker } from '@allmightypush/push';
import { SQLiteStorageAdapter } from '@allmightypush/push-storage-sqlite';
import { WebPushProvider } from '@allmightypush/push-webpush';

const storage = new SQLiteStorageAdapter({ filename: './push.db' });

const provider = new WebPushProvider({
  vapidPublicKey: 'YOUR_PUBLIC_KEY',
  vapidPrivateKey: 'YOUR_PRIVATE_KEY',
  vapidSubject: 'mailto:admin@example.com',
});
```

### 3. Configure PushCore

```typescript
const pushCore = new PushCore();

pushCore.configure({
  vapidKeys: {
    publicKey: 'YOUR_PUBLIC_KEY',
    privateKey: 'YOUR_PRIVATE_KEY',
    subject: 'mailto:admin@example.com',
  },
  storageAdapter: storage,
  providerAdapter: provider,
  retryPolicy: {
    maxRetries: 8,
    baseDelay: 1000,
    backoffFactor: 2,
    maxDelay: 3600000,
    jitter: true,
  },
});
```

### 4. Create Subscription

```typescript
const subscription = await storage.createSubscription({
  endpoint: 'https://fcm.googleapis.com/fcm/send/...',
  keys: {
    p256dh: 'user-public-key',
    auth: 'user-auth-secret',
  },
  userId: 'user-123',
});
```

### 5. Send Notification

```typescript
const result = await pushCore.sendNotification(subscription, {
  title: 'Hello!',
  body: 'This is a push notification',
  icon: '/icon.png',
  data: { url: '/news/1' },
});

if (result.success) {
  console.log('Notification sent!');
} else {
  console.error('Failed:', result.error);
}
```

### 6. Batch Send

```typescript
const subscriptions = await storage.findSubscriptions({ status: 'active' });

const batchResult = await pushCore.batchSend(subscriptions, {
  title: 'Breaking News',
  body: 'Important update for all users',
});

console.log(`Sent to ${batchResult.success}/${batchResult.total}`);
```

### 7. Start Worker

```typescript
const worker = new RetryWorker(storage, provider, {
  maxRetries: 8,
  baseDelay: 1000,
  backoffFactor: 2,
  maxDelay: 3600000,
  jitter: true,
});

await worker.start();
console.log('Worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  await worker.stop();
  await pushCore.shutdown();
  await storage.close();
  process.exit(0);
});
```

## With Express Middleware

```bash
npm install @allmightypush/push-express express
```

```typescript
import express from 'express';
import { createExpressMiddleware } from '@allmightypush/push-express';

const app = express();
app.use(express.json());

app.use('/api/push', createExpressMiddleware({ 
  storageAdapter: storage,
  authMiddleware: (req, res, next) => {
    // Your authentication logic
    if (req.headers.authorization === 'Bearer valid-token') {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  },
}));

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

API Endpoints:
- `POST /api/push/subscriptions` - Create subscription
- `GET /api/push/subscriptions/:id` - Get subscription
- `GET /api/push/subscriptions` - List subscriptions
- `PATCH /api/push/subscriptions/:id` - Update subscription
- `DELETE /api/push/subscriptions/:id` - Delete subscription

## With PostgreSQL

```bash
npm install @allmightypush/push-storage-postgres pg
```

```typescript
import { PostgreSQLStorageAdapter } from '@allmightypush/push-storage-postgres';

const storage = new PostgreSQLStorageAdapter({
  host: 'localhost',
  port: 5432,
  database: 'push_notifications',
  user: 'postgres',
  password: 'password',
});

// Or with connection string
const storage = new PostgreSQLStorageAdapter({
  connectionString: 'postgresql://user:pass@localhost:5432/push',
});
```

## With MongoDB

```bash
npm install @allmightypush/push-storage-mongo mongodb
```

```typescript
import { MongoDBStorageAdapter } from '@allmightypush/push-storage-mongo';

const storage = new MongoDBStorageAdapter({
  uri: 'mongodb://localhost:27017',
  database: 'push_notifications',
});

// Or with MongoDB Atlas
const storage = new MongoDBStorageAdapter({
  uri: 'mongodb+srv://user:pass@cluster.mongodb.net/',
  database: 'push_notifications',
});
```

## Using CLI

```bash
npm install -g @allmightypush/push-cli
```

### Initialize Project

```bash
push-cli init
push-cli generate-keys --output vapid-keys.json --format json
```

### Run Migrations

```bash
# SQLite
push-cli migrate --database ./push.db

# PostgreSQL
push-cli migrate --type postgres --uri postgresql://user:pass@localhost:5432/push

# MongoDB
push-cli migrate --type mongo --uri mongodb://localhost:27017 --database push
```

### Start Worker

```bash
# SQLite
push-cli worker --database ./push.db

# PostgreSQL
push-cli worker --type postgres --uri postgresql://user:pass@localhost:5432/push

# MongoDB
push-cli worker --type mongo --uri mongodb://localhost:27017 --database push
```

### Send Test Notification

```bash
push-cli send-test \
  --endpoint "https://fcm.googleapis.com/fcm/send/..." \
  --p256dh "BNc..." \
  --auth "tBH..." \
  --public-key "BDd..." \
  --private-key "..." \
  --subject "mailto:admin@example.com" \
  --title "Test" \
  --body "Hello World"
```

### Health Check

```bash
push-cli doctor
```

## Environment Variables

```bash
# VAPID Keys
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:admin@example.com

# PostgreSQL
PGHOST=localhost
PGPORT=5432
PGDATABASE=push_notifications
PGUSER=postgres
PGPASSWORD=password
```

## Production Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
CMD ["npx", "@allmightypush/push-cli", "worker"]
```

### Systemd

```ini
[Unit]
Description=Push Notification Worker
After=network.target

[Service]
Type=simple
User=push
WorkingDirectory=/opt/push-notifications
ExecStart=/usr/bin/node /opt/push-notifications/node_modules/.bin/push-cli worker
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Next Steps

1. Read the [full documentation](./README.md)
2. Check out [package-specific READMEs](./packages/)
3. Review [completion reports](./FINAL-PROJECT-STATUS.md)
4. Deploy to production!

## Support

- GitHub Issues: [Report bugs or request features]
- Documentation: See README files in each package
- Examples: Check the READMEs for more examples

## License

MIT
