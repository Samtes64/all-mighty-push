# Push Notification Test Project

A simple, complete example demonstrating the @allmightypush push notification library.

## 🎯 What This Project Does

This test project demonstrates:

- ✅ **Web Push Notifications** - Send push notifications to browsers
- ✅ **Subscription Management** - Subscribe/unsubscribe users
- ✅ **REST API** - Express middleware for subscription management
- ✅ **Batch Sending** - Broadcast to all users
- ✅ **Retry Logic** - Automatic retry with exponential backoff
- ✅ **Worker Process** - Background processing of failed notifications
- ✅ **Statistics** - Real-time stats dashboard
- ✅ **Service Worker** - Client-side push notification handling

## 📁 Project Structure

```
test-project/
├── server.js           # Express server with push notification API
├── worker.js           # Background worker for retry processing
├── package.json        # Dependencies
├── .env.example        # Environment variables template
├── .env                # Your environment variables (create this)
├── SETUP-GUIDE.md      # Detailed setup instructions
├── README.md           # This file
└── public/
    ├── index.html      # Web interface
    ├── app.js          # Client-side JavaScript
    ├── sw.js           # Service Worker
    └── icon.png        # Notification icon
```

## 🚀 Quick Start

### 1. Build the Library

```bash
# From the root directory (parent of test-project)
npm install
npm run build --workspaces
```

### 2. Setup Test Project

```bash
cd test-project
npm install
```

### 3. Generate VAPID Keys

```bash
node ../packages/push-cli/dist/cjs/cli.js generate-keys
```

Copy the generated keys.

### 4. Create .env File

```bash
cp .env.example .env
```

Edit `.env` and add your VAPID keys:

```env
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:admin@example.com
PORT=3000
DATABASE_PATH=./push.db
```

### 5. Start the Server

```bash
npm start
```

### 6. Open in Browser

Open http://localhost:3000

### 7. Test!

1. Click "Subscribe to Notifications"
2. Allow notifications when prompted
3. Click "Send to Me"
4. Receive your first push notification! 🎉

## 📖 Detailed Setup

For detailed step-by-step instructions, see [SETUP-GUIDE.md](./SETUP-GUIDE.md)

## 🔌 API Endpoints

### Get VAPID Public Key
```
GET /api/vapid-public-key
```

### Subscription Management
```
POST   /api/push/subscriptions      # Create subscription
GET    /api/push/subscriptions      # List subscriptions
GET    /api/push/subscriptions/:id  # Get subscription
PATCH  /api/push/subscriptions/:id  # Update subscription
DELETE /api/push/subscriptions/:id  # Delete subscription
```

### Send Notifications
```
POST /api/send-notification  # Send to specific subscription
POST /api/broadcast          # Send to all active subscriptions
```

### Statistics
```
GET /api/stats  # Get subscription and queue statistics
```

## 🧪 Testing Scenarios

### Scenario 1: Single User Notification

1. Subscribe to notifications
2. Send a test notification
3. Verify notification appears

### Scenario 2: Multiple Users

1. Open multiple browser tabs
2. Subscribe in each tab
3. Broadcast a notification
4. All tabs receive the notification

### Scenario 3: Retry Logic

1. Subscribe to notifications
2. Stop the server
3. Try to send a notification (will fail)
4. Start the worker: `npm run worker`
5. Worker will retry the failed notification

### Scenario 4: Unsubscribe

1. Subscribe to notifications
2. Click "Unsubscribe"
3. Try to send (button disabled)
4. Verify subscription removed from database

## 🛠️ Development

### Start Server in Development Mode

```bash
npm run dev
```

### Start Worker

```bash
npm run worker
```

### View Database

```bash
sqlite3 push.db
.tables
SELECT * FROM subscriptions;
SELECT * FROM retry_queue;
.quit
```

## 📊 Monitoring

The web interface shows real-time statistics:

- **Total Subscriptions**: All subscriptions in database
- **Active**: Currently active subscriptions
- **Queue Pending**: Notifications waiting to retry
- **Queue Failed**: Failed notifications

## 🔧 Configuration

Edit `.env` to configure:

```env
# VAPID Keys (required)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com

# Server
PORT=3000

# Database
DATABASE_PATH=./push.db
```

## 🐛 Troubleshooting

### Notifications not appearing?

1. Check browser notification permissions
2. Disable Do Not Disturb mode
3. Check browser console for errors
4. Verify VAPID keys are correct

### Server won't start?

1. Check if port 3000 is available
2. Verify .env file exists with valid keys
3. Ensure packages are built: `npm run build --workspaces`

### Database errors?

```bash
rm push.db
node ../packages/push-cli/dist/cjs/cli.js migrate --database ./push.db
```

See [SETUP-GUIDE.md](./SETUP-GUIDE.md) for more troubleshooting.

## 📚 Learn More

- [Main Library Documentation](../README.md)
- [Setup Guide](./SETUP-GUIDE.md)
- [Express Middleware](../packages/push-express/README.md)
- [CLI Tool](../packages/push-cli/README.md)

## 🎓 Code Examples

### Send Notification (Node.js)

```javascript
const result = await pushCore.sendNotification(subscription, {
  title: 'Hello!',
  body: 'This is a push notification',
  icon: '/icon.png',
  data: { url: '/news/1' },
});
```

### Batch Send

```javascript
const subscriptions = await storage.findSubscriptions({ status: 'active' });
const result = await pushCore.batchSend(subscriptions, {
  title: 'Breaking News',
  body: 'Important update',
});
```

### Subscribe (Client-side)

```javascript
const registration = await navigator.serviceWorker.register('/sw.js');
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: vapidPublicKey,
});
```

## 🚀 Production Deployment

For production:

1. Use HTTPS (required for Service Workers)
2. Use PostgreSQL or MongoDB instead of SQLite
3. Run worker as separate process
4. Set up monitoring and logging
5. Use environment variables for secrets
6. Implement rate limiting
7. Add authentication to API endpoints

## 📝 License

MIT

## 🤝 Contributing

This is a test project. For the main library, see the root directory.

---

**Happy Testing! 🎉**

For questions or issues, check the [SETUP-GUIDE.md](./SETUP-GUIDE.md) or the main library documentation.
