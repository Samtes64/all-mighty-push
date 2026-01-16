# @allmightypush/push-storage-sqlite

SQLite storage adapter for the push notification library.

## Installation

```bash
npm install @allmightypush/push-storage-sqlite
```

## Usage

```typescript
import { SQLiteStorageAdapter } from '@allmightypush/push-storage-sqlite';

// Create adapter with file-based database
const adapter = new SQLiteStorageAdapter({
  filename: './push-notifications.db',
  enableWAL: true,      // Enable WAL mode for better concurrency (default: true)
  autoMigrate: true,    // Run migrations automatically (default: true)
});

// Or use in-memory database for testing
const testAdapter = new SQLiteStorageAdapter({
  filename: ':memory:',
});

// Use with push core
import { PushCore } from '@allmightypush/push-core';

const push = new PushCore();
push.configure({
  storageAdapter: adapter,
  // ... other configuration
});
```

## Configuration Options

### `SQLiteStorageOptions`

- **`filename`** (required): Path to the SQLite database file, or `':memory:'` for an in-memory database
- **`enableWAL`** (optional, default: `true`): Enable Write-Ahead Logging mode for better concurrency
- **`autoMigrate`** (optional, default: `true`): Automatically run database migrations on initialization

## Database Schema

### Subscriptions Table

Stores push notification subscriptions with the following columns:

- `id` (TEXT, PRIMARY KEY): UUID identifier
- `endpoint` (TEXT, NOT NULL): Push service endpoint URL
- `keys` (TEXT, NOT NULL): JSON-encoded encryption keys (p256dh and auth)
- `user_id` (TEXT): Optional user identifier
- `created_at` (INTEGER, NOT NULL): Creation timestamp (Unix milliseconds)
- `updated_at` (INTEGER, NOT NULL): Last update timestamp (Unix milliseconds)
- `last_used_at` (INTEGER): Last successful send timestamp (Unix milliseconds)
- `failed_count` (INTEGER, NOT NULL, DEFAULT 0): Consecutive failure count
- `status` (TEXT, NOT NULL): Subscription status ('active', 'blocked', or 'expired')
- `expires_at` (INTEGER): Optional expiration timestamp (Unix milliseconds)
- `metadata` (TEXT): JSON-encoded arbitrary metadata

**Indexes:**
- `idx_subscriptions_user_id` on `user_id`
- `idx_subscriptions_status` on `status`

### Retry Queue Table

Stores failed notifications awaiting retry:

- `id` (TEXT, PRIMARY KEY): UUID identifier
- `subscription_id` (TEXT, NOT NULL): Foreign key to subscriptions table
- `payload` (TEXT, NOT NULL): JSON-encoded notification payload
- `attempt` (INTEGER, NOT NULL): Current attempt number (0-indexed)
- `next_retry_at` (INTEGER, NOT NULL): Next retry timestamp (Unix milliseconds)
- `last_error` (TEXT): Last error message
- `created_at` (INTEGER, NOT NULL): Creation timestamp (Unix milliseconds)

**Indexes:**
- `idx_retry_queue_next_retry` on `next_retry_at`

**Foreign Keys:**
- `subscription_id` references `subscriptions(id)` with CASCADE DELETE

## Migrations

The adapter automatically creates the required tables and indexes on initialization (when `autoMigrate` is `true`). You can also run migrations manually:

```typescript
await adapter.migrate();
```

Migrations are idempotent and can be safely called multiple times.

## Features

- ✅ Full StorageAdapter interface implementation
- ✅ Automatic schema creation and migrations
- ✅ WAL mode for better concurrency
- ✅ Efficient indexes for common queries
- ✅ Foreign key constraints with cascade delete
- ✅ In-memory database support for testing
- ✅ TypeScript type definitions included

## License

MIT
