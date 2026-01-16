# @allmightypush/push-storage-mongo

MongoDB storage adapter for the push notification library.

## Installation

```bash
npm install @allmightypush/push-storage-mongo @allmightypush/push-core mongodb
```

## Usage

```typescript
import { MongoDBStorageAdapter } from '@allmightypush/push-storage-mongo';
import { PushCore } from '@allmightypush/push-core';

const storage = new MongoDBStorageAdapter({
  uri: 'mongodb://localhost:27017',
  database: 'push_notifications',
});

const pushCore = new PushCore();
pushCore.configure({
  storageAdapter: storage,
  // ... other configuration
});
```

## Configuration Options

```typescript
interface MongoDBStorageOptions {
  // Connection URI (required)
  uri: string;
  
  // Database name (required)
  database: string;
  
  // MongoDB client options (optional)
  clientOptions?: MongoClientOptions;
  
  // Whether to create indexes automatically (default: true)
  autoCreateIndexes?: boolean;
}
```

## Database Schema

The adapter creates two collections:

### subscriptions

```javascript
{
  id: String (UUID),
  endpoint: String,
  keys: {
    p256dh: String,
    auth: String
  },
  userId: String,
  createdAt: Date,
  updatedAt: Date,
  lastUsedAt: Date,
  failedCount: Number,
  status: String, // 'active', 'blocked', or 'expired'
  expiresAt: Date,
  metadata: Object
}

// Indexes
db.subscriptions.createIndex({ userId: 1 });
db.subscriptions.createIndex({ status: 1 });
db.subscriptions.createIndex({ endpoint: 1 }, { unique: true });
```

### retry_queue

```javascript
{
  id: String (UUID),
  subscriptionId: String,
  payload: Object,
  attempt: Number,
  nextRetryAt: Date,
  lastError: String,
  createdAt: Date
}

// Indexes
db.retry_queue.createIndex({ nextRetryAt: 1 });
db.retry_queue.createIndex({ subscriptionId: 1 });
```

## Features

- ✅ Full StorageAdapter interface implementation
- ✅ Connection pooling built into MongoDB driver
- ✅ Flexible document storage
- ✅ Automatic index creation
- ✅ Unique endpoint constraint
- ✅ UUID identifiers
- ✅ Timestamp tracking

## Connection Options

You can pass MongoDB client options:

```typescript
const storage = new MongoDBStorageAdapter({
  uri: 'mongodb://localhost:27017',
  database: 'push_notifications',
  clientOptions: {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  },
});
```

## MongoDB Atlas

Works seamlessly with MongoDB Atlas:

```typescript
const storage = new MongoDBStorageAdapter({
  uri: 'mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority',
  database: 'push_notifications',
});
```

## Replica Sets

Supports MongoDB replica sets:

```typescript
const storage = new MongoDBStorageAdapter({
  uri: 'mongodb://host1:27017,host2:27017,host3:27017/push_notifications?replicaSet=myReplicaSet',
  database: 'push_notifications',
});
```

## Indexes

Indexes are created automatically by default. To create them manually:

```typescript
const storage = new MongoDBStorageAdapter({
  uri: 'mongodb://localhost:27017',
  database: 'push_notifications',
  autoCreateIndexes: false,
});

await storage.migrate();
```

## Graceful Shutdown

Always close the adapter when shutting down:

```typescript
await storage.close();
```

## License

MIT
