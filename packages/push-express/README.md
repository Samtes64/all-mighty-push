# @allmightypush/push-express

Express middleware for managing push notification subscriptions.

## Installation

```bash
npm install @allmightypush/push-express @allmightypush/push-core express
```

## Quick Start

```typescript
import express from 'express';
import { createExpressMiddleware } from '@allmightypush/push-express';
import { SQLiteStorageAdapter } from '@allmightypush/push-storage-sqlite';

const app = express();
const storage = new SQLiteStorageAdapter({ filename: './push.db' });

app.use(express.json());
app.use('/api/push', createExpressMiddleware({ storageAdapter: storage }));

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## API Endpoints

### POST /subscriptions

Create a new push notification subscription.

**Request Body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "user-public-key",
    "auth": "user-auth-secret"
  },
  "userId": "optional-user-id",
  "metadata": {
    "deviceType": "mobile",
    "appVersion": "1.0.0"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "subscription-id",
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": { "p256dh": "...", "auth": "..." },
  "userId": "optional-user-id",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /subscriptions/:id

Retrieve a subscription by ID.

**Response:** `200 OK` or `404 Not Found`

### GET /subscriptions

List subscriptions with optional filtering and pagination.

**Query Parameters:**
- `userId` - Filter by user ID
- `status` - Filter by status (active, expired, failed)
- `limit` - Maximum results (default: 100)
- `offset` - Pagination offset (default: 0)

**Response:** `200 OK`
```json
{
  "subscriptions": [...],
  "total": 10,
  "limit": 100,
  "offset": 0
}
```

### PATCH /subscriptions/:id

Update a subscription.

**Request Body:**
```json
{
  "status": "expired",
  "metadata": { "updated": true }
}
```

**Response:** `200 OK` or `404 Not Found`

### DELETE /subscriptions/:id

Delete a subscription.

**Response:** `204 No Content` or `404 Not Found`

## Configuration Options

```typescript
interface ExpressMiddlewareOptions {
  // Storage adapter for managing subscriptions (required)
  storageAdapter: StorageAdapter;

  // Optional authentication middleware
  authMiddleware?: (req, res, next) => void;

  // Custom base path (default: '')
  basePath?: string;

  // Custom validation function
  validateSubscription?: (subscription) => Promise<void> | void;
}
```

## Examples

### With Authentication

```typescript
import { createExpressMiddleware } from '@allmightypush/push-express';

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token || !isValidToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

app.use('/api/push', createExpressMiddleware({
  storageAdapter: storage,
  authMiddleware,
}));
```

### With Custom Validation

```typescript
app.use('/api/push', createExpressMiddleware({
  storageAdapter: storage,
  validateSubscription: async (data) => {
    // Ensure endpoint uses HTTPS
    if (!data.endpoint?.startsWith('https://')) {
      throw new Error('Endpoint must use HTTPS');
    }
    
    // Check against allowed domains
    const url = new URL(data.endpoint);
    if (!allowedDomains.includes(url.hostname)) {
      throw new Error('Endpoint domain not allowed');
    }
  },
}));
```

### With Custom Base Path

```typescript
app.use('/api/push', createExpressMiddleware({
  storageAdapter: storage,
  basePath: '/v1', // Routes will be /api/push/v1/subscriptions
}));
```

## Error Handling

The middleware returns appropriate HTTP status codes:

- `200 OK` - Successful GET/PATCH
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Authentication failed (if auth middleware used)
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## License

MIT
