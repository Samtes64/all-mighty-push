# @allmightypush/push-storage-postgres

PostgreSQL storage adapter for the push notification library.

## Installation

```bash
npm install @allmightypush/push-storage-postgres @allmightypush/push-core pg
```

## Usage

```typescript
import { PostgreSQLStorageAdapter } from '@allmightypush/push-storage-postgres';
import { PushCore } from '@allmightypush/push-core';

const storage = new PostgreSQLStorageAdapter({
  host: 'localhost',
  port: 5432,
  database: 'push_notifications',
  user: 'postgres',
  password: 'password',
});

const pushCore = new PushCore();
pushCore.configure({
  storageAdapter: storage,
  // ... other configuration
});
```

## Configuration Options

The adapter accepts all standard [node-postgres Pool configuration options](https://node-postgres.com/apis/pool):

```typescript
interface PostgreSQLStorageOptions {
  // Connection options
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  connectionString?: string;
  
  // Pool options
  max?: number;              // Maximum pool size (default: 10)
  idleTimeoutMillis?: number; // Idle timeout (default: 30000)
  connectionTimeoutMillis?: number; // Connection timeout (default: 0)
  
  // Adapter options
  autoMigrate?: boolean;     // Run migrations automatically (default: true)
}
```

## Database Schema

The adapter creates two tables:

### subscriptions

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  user_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('active', 'blocked', 'expired')),
  expires_at TIMESTAMP,
  metadata JSONB
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

### retry_queue

```sql
CREATE TABLE retry_queue (
  id UUID PRIMARY KEY,
  subscription_id UUID NOT NULL,
  payload JSONB NOT NULL,
  attempt INTEGER NOT NULL,
  next_retry_at TIMESTAMP NOT NULL,
  last_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX idx_retry_queue_next_retry ON retry_queue(next_retry_at);
```

## Features

- ✅ Full StorageAdapter interface implementation
- ✅ Connection pooling for performance
- ✅ JSONB for efficient key and metadata storage
- ✅ Automatic migrations
- ✅ Foreign key constraints
- ✅ Indexed queries for performance
- ✅ UUID primary keys
- ✅ Timestamp tracking

## Connection String

You can use a connection string instead of individual options:

```typescript
const storage = new PostgreSQLStorageAdapter({
  connectionString: 'postgresql://user:password@localhost:5432/push_notifications',
});
```

## Environment Variables

The adapter respects standard PostgreSQL environment variables:

- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`

## Migrations

Migrations run automatically by default. To run them manually:

```typescript
const storage = new PostgreSQLStorageAdapter({
  connectionString: 'postgresql://...',
  autoMigrate: false,
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
