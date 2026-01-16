/**
 * Simple Express server demonstrating push notification functionality
 */

require('dotenv').config();
const express = require('express');
const path = require('path');

// Import from local packages (in production, these would be from npm)
const { PushCore } = require('../packages/push-core/dist/cjs/index.js');
const { SQLiteStorageAdapter } = require('../packages/push-storage-sqlite/dist/cjs/index.js');
const { WebPushProvider } = require('../packages/push-webpush/dist/cjs/index.js');
const { createExpressMiddleware } = require('../packages/push-express/dist/cjs/index.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize storage adapter
const storage = new SQLiteStorageAdapter({
  filename: process.env.DATABASE_PATH || './push.db',
});

console.log('✓ Storage adapter initialized');

// Initialize Web Push provider
const provider = new WebPushProvider({
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
});

console.log('✓ Web Push provider initialized');

// Initialize PushCore
const pushCore = new PushCore();
pushCore.configure({
  vapidKeys: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  },
  storageAdapter: storage,
  providerAdapter: provider,
  retryPolicy: {
    maxRetries: 3,
    baseDelay: 1000,
    backoffFactor: 2,
    maxDelay: 10000,
    jitter: true,
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 60000,
  },
  lifecycleHooks: {
    onSend: async (subscription, payload) => {
      console.log(`📤 Sending notification to ${subscription.id}`);
    },
    onSuccess: async (subscription) => {
      console.log(`✓ Successfully sent to ${subscription.id}`);
    },
    onFailure: async (subscription, error) => {
      console.error(`✗ Failed to send to ${subscription.id}:`, error.message);
    },
  },
});

console.log('✓ PushCore configured');

// Mount Express middleware for subscription management
app.use('/api/push', createExpressMiddleware({
  storageAdapter: storage,
}));

console.log('✓ Express middleware mounted at /api/push');

// API endpoint to get VAPID public key
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// API endpoint to send notification to a specific subscription
app.post('/api/send-notification', async (req, res) => {
  try {
    const { subscriptionId, title, body, icon, data } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'subscriptionId is required' });
    }

    const subscription = await storage.getSubscriptionById(subscriptionId);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const result = await pushCore.sendNotification(subscription, {
      title: title || 'Test Notification',
      body: body || 'This is a test notification',
      icon: icon || '/icon.png',
      data: data || {},
    });

    res.json({
      success: result.success,
      subscriptionId: result.subscriptionId,
      enqueued: result.enqueued,
      error: result.error?.message,
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to send notification to all active subscriptions
app.post('/api/broadcast', async (req, res) => {
  try {
    const { title, body, icon, data } = req.body;

    const subscriptions = await storage.findSubscriptions({ status: 'active' });

    if (subscriptions.length === 0) {
      return res.json({
        message: 'No active subscriptions found',
        total: 0,
        success: 0,
      });
    }

    const result = await pushCore.batchSend(subscriptions, {
      title: title || 'Broadcast Notification',
      body: body || 'This is a broadcast to all users',
      icon: icon || '/icon.png',
      data: data || {},
    });

    res.json({
      total: result.total,
      success: result.success,
      failed: result.failed,
      retried: result.retried,
    });
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get queue statistics
app.get('/api/stats', async (req, res) => {
  try {
    const queueStats = await storage.getQueueStats();
    const subscriptions = await storage.findSubscriptions({});
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active');

    res.json({
      subscriptions: {
        total: subscriptions.length,
        active: activeSubscriptions.length,
        expired: subscriptions.filter(s => s.status === 'expired').length,
        blocked: subscriptions.filter(s => s.status === 'blocked').length,
      },
      queue: queueStats,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(60));
  console.log('🚀 Push Notification Test Server');
  console.log('='.repeat(60));
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  - GET  /api/vapid-public-key`);
  console.log(`  - POST /api/push/subscriptions`);
  console.log(`  - GET  /api/push/subscriptions`);
  console.log(`  - POST /api/send-notification`);
  console.log(`  - POST /api/broadcast`);
  console.log(`  - GET  /api/stats`);
  console.log('='.repeat(60));
  console.log('');
  console.log('Open http://localhost:3000 in your browser to test');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⚠ Received SIGTERM, shutting down gracefully...');
  await pushCore.shutdown();
  await storage.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⚠ Received SIGINT, shutting down gracefully...');
  await pushCore.shutdown();
  await storage.close();
  process.exit(0);
});
