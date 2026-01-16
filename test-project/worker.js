/**
 * Worker process for handling retry queue
 */

require('dotenv').config();

// Import from npm packages
const {
  RetryWorker,
  SQLiteStorageAdapter,
  WebPushProvider,
} = require('@allmightypush/push');

// Import from local packages
// const { RetryWorker } = require('../packages/push-core/dist/cjs/index.js');
// const { SQLiteStorageAdapter } = require('../packages/push-storage-sqlite/dist/cjs/index.js');
// const { WebPushProvider } = require('../packages/push-webpush/dist/cjs/index.js');


console.log('='.repeat(60));
console.log('🔄 Push Notification Retry Worker');
console.log('='.repeat(60));

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

// Initialize worker
const worker = new RetryWorker(storage, provider, {
  maxRetries: 3,
  baseDelay: 1000,
  backoffFactor: 2,
  maxDelay: 10000,
  jitter: true,
}, {
  pollInterval: 5000,
  concurrency: 5,
  batchSize: 20,
});

console.log('✓ Retry worker configured');
console.log('');
console.log('Starting worker...');
console.log('Press Ctrl+C to stop');
console.log('='.repeat(60));
console.log('');

// Start worker
worker.start().then(() => {
  console.log('✓ Worker is running');
}).catch((error) => {
  console.error('✗ Failed to start worker:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⚠ Received SIGTERM, shutting down gracefully...');
  await worker.stop();
  await storage.close();
  console.log('✓ Worker stopped');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⚠ Received SIGINT, shutting down gracefully...');
  await worker.stop();
  await storage.close();
  console.log('✓ Worker stopped');
  process.exit(0);
});
