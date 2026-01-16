# 🔔 Push Notification Test Project

A complete, production-ready example demonstrating the **@allmightypush** push notification library.

> **Live Demo**: This project uses the published npm packages from the registry. Perfect for testing and learning!

## 📦 What You'll Build

A full-featured push notification system with:

- ✅ **Web Push Notifications** - Browser notifications that work even when the app is closed
- ✅ **Beautiful Web Interface** - Minimalistic Notion-style UI
- ✅ **REST API** - Complete subscription management
- ✅ **Real-time Statistics** - Live dashboard with metrics
- ✅ **Automatic Retries** - Failed notifications retry automatically
- ✅ **Background Worker** - Processes retries in the background
- ✅ **Service Worker** - Handles push events on the client

## 🎯 Prerequisites

Before starting, ensure you have:

- **Node.js** v16 or higher ([Download](https://nodejs.org/))
- **npm** v7 or higher (comes with Node.js)
- A modern web browser (Chrome, Firefox, Edge, or Safari)
- 10 minutes of your time ⏱️

Check your versions:
```bash
node --version  # Should be v16.0.0 or higher
npm --version   # Should be 7.0.0 or higher
```

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Create Project Directory

```bash
# Create a new directory for your project
mkdir my-push-app
cd my-push-app
```

### Step 2: Initialize npm Project

```bash
npm init -y
```


### Step 3: Install Dependencies

```bash
# Install the push notification library
npm install @allmightypush/push

# Install Express for the server
npm install express dotenv

# Install development dependencies
npm install --save-dev nodemon
```

### Step 4: Generate VAPID Keys

VAPID keys are required for Web Push authentication. Generate them using npx:

```bash
npx @allmightypush/push-cli generate-keys
```

**Output:**
```
Public Key:  BDd4h8G...
Private Key: k3j2h1g...
```

**⚠️ Important:** Copy these keys! You'll need them in the next step.

### Step 5: Create Environment File

Create a `.env` file in your project root:

```bash
# Create .env file
cat > .env << 'EOF'
VAPID_PUBLIC_KEY=YOUR_PUBLIC_KEY_HERE
VAPID_PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
VAPID_SUBJECT=mailto:your-email@example.com
PORT=3000
DATABASE_PATH=./push.db
EOF
```

**Now edit `.env`** and replace:
- `YOUR_PUBLIC_KEY_HERE` with your generated public key
- `YOUR_PRIVATE_KEY_HERE` with your generated private key
- `your-email@example.com` with your actual email

### Step 6: Create Server File

Create `server.js`:

```javascript
require('dotenv').config();
const express = require('express');
const path = require('path');
const {
  PushCore,
  SQLiteStorageAdapter,
  WebPushProvider,
  createExpressMiddleware,
} = require('@allmightypush/push');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Initialize storage adapter
const storage = new SQLiteStorageAdapter({
  filename: process.env.DATABASE_PATH || './push.db',
});

// Initialize Web Push provider
const provider = new WebPushProvider({
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT,
});

// Initialize PushCore
const pushCore = new PushCore();
pushCore.configure({
  vapidKeys: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  },
  storageAdapter: storage,
  providerAdapter: provider,
});

// Mount Express middleware
app.use('/api/push', createExpressMiddleware(storage));

// Get VAPID public key
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Send notification to specific subscription
app.post('/api/send-notification', async (req, res) => {
  try {
    const { subscriptionId, title, body, icon, data } = req.body;
    const subscription = await storage.getSubscription(subscriptionId);
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const result = await pushCore.sendNotification(subscription, {
      title,
      body,
      icon: icon || '/icon.png',
      data: data || {},
    });

    res.json({ success: true, result });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Broadcast to all active subscriptions
app.post('/api/broadcast', async (req, res) => {
  try {
    const { title, body, icon, data } = req.body;
    const subscriptions = await storage.findSubscriptions({ status: 'active' });

    const result = await pushCore.batchSend(subscriptions, {
      title,
      body,
      icon: icon || '/icon.png',
      data: data || {},
    });

    res.json({ success: true, result });
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const allSubs = await storage.findSubscriptions({});
    const activeSubs = await storage.findSubscriptions({ status: 'active' });
    const pendingRetries = await storage.getRetryQueue({ status: 'pending' });
    const failedRetries = await storage.getRetryQueue({ status: 'failed' });

    res.json({
      totalSubscriptions: allSubs.length,
      activeSubscriptions: activeSubs.length,
      queuePending: pendingRetries.length,
      queueFailed: failedRetries.length,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await pushCore.shutdown();
  await storage.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
============================================================
🚀 Push Notification Server
============================================================
Server running at: http://localhost:${PORT}
API endpoints:
  - GET  /api/vapid-public-key
  - POST /api/push/subscriptions
  - GET  /api/push/subscriptions
  - POST /api/send-notification
  - POST /api/broadcast
  - GET  /api/stats
============================================================

Open http://localhost:${PORT} in your browser to test
  `);
});
```


### Step 7: Create Public Directory

```bash
mkdir public
```

### Step 8: Create Web Interface

Create `public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Push Notification Test</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #ffffff;
      color: #37352f;
      min-height: 100vh;
      padding: 40px 20px;
      line-height: 1.6;
    }
    .container { max-width: 900px; margin: 0 auto; }
    .card {
      background: #ffffff;
      border: 1px solid #e9e9e7;
      border-radius: 3px;
      padding: 40px;
      margin-bottom: 16px;
      transition: box-shadow 0.2s ease;
    }
    .card:hover { box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
    h1 {
      color: #000000;
      margin-bottom: 8px;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    h2 {
      color: #000000;
      margin-bottom: 24px;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    p { color: #787774; margin-bottom: 24px; font-size: 14px; }
    .status {
      padding: 12px 16px;
      border-radius: 3px;
      margin-bottom: 24px;
      font-size: 14px;
      border-left: 3px solid;
    }
    .status.info { background: #f7f6f3; color: #37352f; border-left-color: #37352f; }
    .status.success { background: #f7f6f3; color: #000000; border-left-color: #000000; }
    .status.error { background: #fbe4e4; color: #37352f; border-left-color: #eb5757; }
    button {
      background: #000000;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 3px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      margin-right: 8px;
      margin-bottom: 8px;
      font-family: inherit;
    }
    button:hover { background: #37352f; }
    button:disabled { background: #e9e9e7; color: #9b9a97; cursor: not-allowed; }
    button.secondary { background: #ffffff; color: #37352f; border: 1px solid #e9e9e7; }
    button.secondary:hover { background: #f7f6f3; }
    button.danger { background: #eb5757; color: #ffffff; }
    button.danger:hover { background: #d84040; }
    .form-group { margin-bottom: 20px; }
    label { display: block; margin-bottom: 8px; color: #37352f; font-size: 14px; font-weight: 500; }
    input, textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e9e9e7;
      border-radius: 3px;
      font-size: 14px;
      font-family: inherit;
      color: #37352f;
      background: #ffffff;
      transition: all 0.15s ease;
    }
    input:focus, textarea:focus {
      outline: none;
      border-color: #000000;
      box-shadow: 0 0 0 1px #000000;
    }
    textarea { resize: vertical; min-height: 80px; line-height: 1.5; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 24px;
    }
    .stat-box {
      background: #f7f6f3;
      padding: 20px;
      border-radius: 3px;
      border: 1px solid #e9e9e7;
      text-align: center;
    }
    .stat-value { font-size: 36px; font-weight: 700; color: #000000; letter-spacing: -0.02em; }
    .stat-label {
      font-size: 12px;
      color: #787774;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Push Notification Test</h1>
      <p>A minimalistic demo of the @allmightypush notification library</p>
      <div id="status" class="status info">Checking notification support...</div>
      <button id="subscribeBtn" onclick="subscribe()" disabled>Subscribe to Notifications</button>
      <button id="unsubscribeBtn" onclick="unsubscribe()" disabled style="display: none;" class="danger">Unsubscribe</button>
      <button onclick="refreshStats()" class="secondary">Refresh Stats</button>
    </div>

    <div class="card">
      <h2>Send Test Notification</h2>
      <div class="form-group">
        <label for="notifTitle">Title</label>
        <input type="text" id="notifTitle" value="Test Notification" placeholder="Notification title">
      </div>
      <div class="form-group">
        <label for="notifBody">Body</label>
        <textarea id="notifBody" placeholder="Notification body">Hello! This is a test notification.</textarea>
      </div>
      <button id="sendBtn" onclick="sendNotification()" disabled>Send to Me</button>
      <button id="broadcastBtn" onclick="broadcast()" class="secondary" disabled>Broadcast to All</button>
    </div>

    <div class="card">
      <h2>Statistics</h2>
      <div class="stats">
        <div class="stat-box"><div class="stat-value" id="totalSubs">—</div><div class="stat-label">Total</div></div>
        <div class="stat-box"><div class="stat-value" id="activeSubs">—</div><div class="stat-label">Active</div></div>
        <div class="stat-box"><div class="stat-value" id="queuePending">—</div><div class="stat-label">Pending</div></div>
        <div class="stat-box"><div class="stat-value" id="queueFailed">—</div><div class="stat-label">Failed</div></div>
      </div>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>
```


### Step 9: Create Client JavaScript

Create `public/app.js`:

```javascript
let currentSubscription = null;

// Check if browser supports notifications
async function checkSupport() {
  const statusEl = document.getElementById('status');
  
  if (!('serviceWorker' in navigator)) {
    statusEl.textContent = '❌ Service Workers not supported';
    statusEl.className = 'status error';
    return false;
  }
  
  if (!('PushManager' in window)) {
    statusEl.textContent = '❌ Push notifications not supported';
    statusEl.className = 'status error';
    return false;
  }
  
  statusEl.textContent = '✅ Push notifications are supported!';
  statusEl.className = 'status success';
  document.getElementById('subscribeBtn').disabled = false;
  
  await checkExistingSubscription();
  await refreshStats();
  
  return true;
}

// Check for existing subscription
async function checkExistingSubscription() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      currentSubscription = subscription;
      updateUIForSubscribed();
    }
  } catch (error) {
    console.error('Error checking subscription:', error);
  }
}

// Subscribe to push notifications
async function subscribe() {
  const statusEl = document.getElementById('status');
  const subscribeBtn = document.getElementById('subscribeBtn');
  
  try {
    subscribeBtn.disabled = true;
    statusEl.textContent = '⏳ Subscribing...';
    statusEl.className = 'status info';
    
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    
    // Get VAPID public key
    const response = await fetch('/api/vapid-public-key');
    const { publicKey } = await response.json();
    
    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    
    // Save subscription to server
    const saveResponse = await fetch('/api/push/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    });
    
    if (!saveResponse.ok) throw new Error('Failed to save subscription');
    
    const savedSub = await saveResponse.json();
    currentSubscription = { ...subscription, id: savedSub.id };
    
    statusEl.textContent = '✅ Successfully subscribed!';
    statusEl.className = 'status success';
    updateUIForSubscribed();
    await refreshStats();
    
  } catch (error) {
    console.error('Subscribe error:', error);
    statusEl.textContent = `❌ Error: ${error.message}`;
    statusEl.className = 'status error';
    subscribeBtn.disabled = false;
  }
}

// Unsubscribe from push notifications
async function unsubscribe() {
  const statusEl = document.getElementById('status');
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      
      // Remove from server
      if (currentSubscription && currentSubscription.id) {
        await fetch(`/api/push/subscriptions/${currentSubscription.id}`, {
          method: 'DELETE',
        });
      }
    }
    
    currentSubscription = null;
    statusEl.textContent = '✅ Unsubscribed successfully';
    statusEl.className = 'status success';
    updateUIForUnsubscribed();
    await refreshStats();
    
  } catch (error) {
    console.error('Unsubscribe error:', error);
    statusEl.textContent = `❌ Error: ${error.message}`;
    statusEl.className = 'status error';
  }
}

// Send notification to current user
async function sendNotification() {
  if (!currentSubscription || !currentSubscription.id) {
    alert('Please subscribe first');
    return;
  }
  
  const title = document.getElementById('notifTitle').value;
  const body = document.getElementById('notifBody').value;
  
  try {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: currentSubscription.id,
        title,
        body,
      }),
    });
    
    if (!response.ok) throw new Error('Failed to send notification');
    
    alert('✅ Notification sent!');
  } catch (error) {
    console.error('Send error:', error);
    alert(`❌ Error: ${error.message}`);
  }
}

// Broadcast to all users
async function broadcast() {
  const title = document.getElementById('notifTitle').value;
  const body = document.getElementById('notifBody').value;
  
  try {
    const response = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    });
    
    if (!response.ok) throw new Error('Failed to broadcast');
    
    const result = await response.json();
    alert(`✅ Broadcast sent!\nSuccess: ${result.result.successCount}\nFailed: ${result.result.failureCount}`);
    await refreshStats();
  } catch (error) {
    console.error('Broadcast error:', error);
    alert(`❌ Error: ${error.message}`);
  }
}

// Refresh statistics
async function refreshStats() {
  try {
    const response = await fetch('/api/stats');
    const stats = await response.json();
    
    document.getElementById('totalSubs').textContent = stats.totalSubscriptions;
    document.getElementById('activeSubs').textContent = stats.activeSubscriptions;
    document.getElementById('queuePending').textContent = stats.queuePending;
    document.getElementById('queueFailed').textContent = stats.queueFailed;
  } catch (error) {
    console.error('Stats error:', error);
  }
}

// Update UI for subscribed state
function updateUIForSubscribed() {
  document.getElementById('subscribeBtn').style.display = 'none';
  document.getElementById('unsubscribeBtn').style.display = 'inline-block';
  document.getElementById('unsubscribeBtn').disabled = false;
  document.getElementById('sendBtn').disabled = false;
  document.getElementById('broadcastBtn').disabled = false;
}

// Update UI for unsubscribed state
function updateUIForUnsubscribed() {
  document.getElementById('subscribeBtn').style.display = 'inline-block';
  document.getElementById('subscribeBtn').disabled = false;
  document.getElementById('unsubscribeBtn').style.display = 'none';
  document.getElementById('sendBtn').disabled = true;
  document.getElementById('broadcastBtn').disabled = true;
}

// Convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Initialize on page load
checkSupport();
```


### Step 10: Create Service Worker

Create `public/sw.js`:

```javascript
self.addEventListener('push', (event) => {
  console.log('Push received:', event);
  
  let data = { title: 'Push Notification', body: 'You have a new notification' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/icon.png',
    badge: '/icon.png',
    data: data.data || {},
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    requireInteraction: false,
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Subscription changed:', event);
  // Handle subscription change if needed
});
```

### Step 11: Add Notification Icon

Download or create an icon and save it as `public/icon.png` (192x192px recommended).

Or create a simple placeholder:
```bash
# On Linux/Mac, create a simple colored square
convert -size 192x192 xc:#000000 public/icon.png

# Or download a free icon from https://www.flaticon.com/
```

### Step 12: Update package.json Scripts

Edit your `package.json` and add these scripts:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

### Step 13: Start the Server

```bash
npm start
```

**Expected output:**
```
============================================================
🚀 Push Notification Server
============================================================
Server running at: http://localhost:3000
API endpoints:
  - GET  /api/vapid-public-key
  - POST /api/push/subscriptions
  - GET  /api/push/subscriptions
  - POST /api/send-notification
  - POST /api/broadcast
  - GET  /api/stats
============================================================

Open http://localhost:3000 in your browser to test
```

### Step 14: Test in Browser

1. Open http://localhost:3000
2. Click **"Subscribe to Notifications"**
3. Allow notifications when prompted
4. Click **"Send to Me"**
5. You should see a push notification! 🎉

---

## 📁 Final Project Structure

```
my-push-app/
├── .env                    # Environment variables (VAPID keys)
├── package.json            # Dependencies and scripts
├── server.js               # Express server
├── push.db                 # SQLite database (auto-created)
└── public/
    ├── index.html          # Web interface
    ├── app.js              # Client-side JavaScript
    ├── sw.js               # Service Worker
    └── icon.png            # Notification icon
```

---

## 🎯 Testing Scenarios

### Test 1: Single User Notification

1. Subscribe to notifications
2. Enter a custom title and body
3. Click "Send to Me"
4. Verify notification appears

### Test 2: Multiple Users (Broadcast)

1. Open the app in **3 different browser tabs**
2. Subscribe in each tab
3. In one tab, click "Broadcast to All"
4. All 3 tabs should receive the notification

### Test 3: Custom Notification Data

Modify `server.js` to send custom data:

```javascript
const result = await pushCore.sendNotification(subscription, {
  title: '🎉 Special Offer!',
  body: 'Get 50% off today only!',
  icon: '/icon.png',
  data: { 
    url: '/offers',
    offerId: '12345'
  },
});
```

### Test 4: Unsubscribe

1. Click "Unsubscribe"
2. Try to send a notification (button should be disabled)
3. Check statistics - active subscriptions should decrease

---

## 🔧 Advanced: Background Worker

For production, you'll want a background worker to retry failed notifications.

Create `worker.js`:

```javascript
require('dotenv').config();
const {
  RetryWorker,
  SQLiteStorageAdapter,
  WebPushProvider,
} = require('@allmightypush/push');

const storage = new SQLiteStorageAdapter({
  filename: process.env.DATABASE_PATH || './push.db',
});

const provider = new WebPushProvider({
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT,
});

const worker = new RetryWorker(storage, provider, {
  maxRetries: 8,
  baseDelay: 1000,
  backoffFactor: 2,
  maxDelay: 3600000,
  jitter: true,
  pollInterval: 5000,
});

console.log('🔄 Starting retry worker...');
worker.start();

process.on('SIGTERM', async () => {
  console.log('Stopping worker...');
  await worker.stop();
  process.exit(0);
});
```

Add to `package.json`:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "worker": "node worker.js"
  }
}
```

Run in a separate terminal:
```bash
npm run worker
```

---

## 🔌 API Reference

### Get VAPID Public Key
```http
GET /api/vapid-public-key
```

**Response:**
```json
{
  "publicKey": "BDd4h8G..."
}
```

### Create Subscription
```http
POST /api/push/subscriptions
Content-Type: application/json

{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

### List Subscriptions
```http
GET /api/push/subscriptions
```

### Send Notification
```http
POST /api/send-notification
Content-Type: application/json

{
  "subscriptionId": "uuid",
  "title": "Hello!",
  "body": "This is a test",
  "icon": "/icon.png",
  "data": { "url": "/page" }
}
```

### Broadcast
```http
POST /api/broadcast
Content-Type: application/json

{
  "title": "Breaking News",
  "body": "Important update",
  "icon": "/icon.png"
}
```

### Get Statistics
```http
GET /api/stats
```

**Response:**
```json
{
  "totalSubscriptions": 10,
  "activeSubscriptions": 8,
  "queuePending": 2,
  "queueFailed": 0
}
```

---

## 🐛 Troubleshooting

### Issue: "Service Workers not supported"

**Solution:** Use a modern browser (Chrome, Firefox, Edge, Safari). Service Workers require HTTPS or localhost.

### Issue: Notifications not appearing

**Possible causes:**

1. **Permission denied**: Check browser notification settings
   - Chrome: `chrome://settings/content/notifications`
   - Firefox: Preferences → Privacy & Security → Permissions → Notifications

2. **Do Not Disturb mode**: Disable system Do Not Disturb
   - macOS: System Preferences → Notifications
   - Windows: Settings → System → Focus assist

3. **Browser notifications disabled**: Enable in browser settings

### Issue: "VAPID keys are missing"

**Solution:** Make sure you:
1. Generated VAPID keys: `npx @allmightypush/push-cli generate-keys`
2. Created `.env` file with the keys
3. Restarted the server after creating `.env`

### Issue: "Error: listen EADDRINUSE"

**Solution:** Port 3000 is already in use. Either:
1. Stop the other process using port 3000
2. Change the port in `.env`: `PORT=3001`

### Issue: Database errors

**Solution:** Delete and recreate the database:
```bash
rm push.db
npm start  # Database will be auto-created
```

### Issue: "Module not found"

**Solution:** Make sure you installed dependencies:
```bash
npm install
```

### Issue: Notifications work on localhost but not on deployed server

**Solution:** Service Workers require HTTPS in production. Deploy to:
- Vercel (free HTTPS)
- Netlify (free HTTPS)
- Heroku (free HTTPS)
- Your own server with Let's Encrypt SSL

---

## 🚀 Production Deployment

### Environment Variables

Set these on your hosting platform:

```env
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:your-email@example.com
PORT=3000
DATABASE_PATH=./push.db
NODE_ENV=production
```

### Use PostgreSQL or MongoDB

For production, use a proper database:

**PostgreSQL:**
```bash
npm install @allmightypush/push-storage-postgres pg
```

```javascript
const { PostgreSQLStorageAdapter } = require('@allmightypush/push-storage-postgres');

const storage = new PostgreSQLStorageAdapter({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
```

**MongoDB:**
```bash
npm install @allmightypush/push-storage-mongo mongodb
```

```javascript
const { MongoDBStorageAdapter } = require('@allmightypush/push-storage-mongo');

const storage = new MongoDBStorageAdapter({
  uri: process.env.MONGODB_URI,
  database: 'push_notifications',
});
```

### Deploy to Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    { "src": "server.js", "use": "@vercel/node" },
    { "src": "public/**", "use": "@vercel/static" }
  ],
  "routes": [
    { "src": "/api/.*", "dest": "server.js" },
    { "src": "/(.*)", "dest": "public/$1" }
  ]
}
```

3. Deploy:
```bash
vercel
```

### Deploy to Heroku

1. Create `Procfile`:
```
web: node server.js
worker: node worker.js
```

2. Deploy:
```bash
heroku create my-push-app
git push heroku main
heroku ps:scale web=1 worker=1
```

### Security Best Practices

1. **Add authentication** to API endpoints
2. **Rate limit** API requests
3. **Validate** all inputs
4. **Use HTTPS** in production
5. **Rotate VAPID keys** periodically
6. **Monitor** for abuse
7. **Set CORS** headers appropriately

---

## 📊 Monitoring & Analytics

### Add Lifecycle Hooks

```javascript
pushCore.configure({
  // ... other config
  lifecycleHooks: {
    onSend: (subscription, payload) => {
      console.log('Sending notification:', subscription.id);
    },
    onSuccess: (subscription, result) => {
      console.log('✅ Success:', subscription.id);
      // Track in analytics
    },
    onFailure: (subscription, error) => {
      console.error('❌ Failed:', subscription.id, error);
      // Alert monitoring system
    },
    onRetry: (subscription, attempt) => {
      console.log(`🔄 Retry ${attempt}:`, subscription.id);
    },
  },
});
```

### Integrate with Monitoring Services

**Sentry:**
```bash
npm install @sentry/node
```

```javascript
const Sentry = require('@sentry/node');

Sentry.init({ dsn: process.env.SENTRY_DSN });

pushCore.configure({
  lifecycleHooks: {
    onFailure: (subscription, error) => {
      Sentry.captureException(error, {
        extra: { subscriptionId: subscription.id },
      });
    },
  },
});
```

---

## 📚 Learn More

### Official Documentation

- [@allmightypush/push](https://www.npmjs.com/package/@allmightypush/push) - Main package
- [@allmightypush/push-core](https://www.npmjs.com/package/@allmightypush/push-core) - Core library
- [@allmightypush/push-express](https://www.npmjs.com/package/@allmightypush/push-express) - Express middleware
- [@allmightypush/push-cli](https://www.npmjs.com/package/@allmightypush/push-cli) - CLI tools

### Web Push Resources

- [Web Push Protocol](https://web.dev/push-notifications-overview/)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

### GitHub Repository

- [Source Code](https://github.com/Samtes64/all-mighty-push)
- [Report Issues](https://github.com/Samtes64/all-mighty-push/issues)
- [Contribute](https://github.com/Samtes64/all-mighty-push/pulls)

---

## 🎓 Code Examples

### Send Notification with Custom Data

```javascript
await pushCore.sendNotification(subscription, {
  title: '🎉 New Message',
  body: 'You have a new message from John',
  icon: '/avatar.png',
  badge: '/badge.png',
  data: {
    url: '/messages/123',
    messageId: '123',
    sender: 'John',
  },
  tag: 'message-123',
  requireInteraction: true,
});
```

### Batch Send with Progress Tracking

```javascript
const subscriptions = await storage.findSubscriptions({ status: 'active' });

const result = await pushCore.batchSend(
  subscriptions,
  {
    title: 'Breaking News',
    body: 'Important update',
  },
  {
    concurrency: 10,
    onProgress: (sent, total) => {
      console.log(`Progress: ${sent}/${total}`);
    },
  }
);

console.log(`Success: ${result.successCount}`);
console.log(`Failed: ${result.failureCount}`);
```

### Custom Retry Policy

```javascript
pushCore.configure({
  retryPolicy: {
    maxRetries: 5,
    baseDelay: 2000,
    backoffFactor: 2,
    maxDelay: 300000,
    jitter: true,
  },
});
```

### Circuit Breaker Configuration

```javascript
pushCore.configure({
  circuitBreaker: {
    failureThreshold: 10,
    resetTimeout: 120000,
    halfOpenRequests: 3,
  },
});
```

### Rate Limiting

```javascript
pushCore.configure({
  rateLimiter: {
    maxTokens: 100,
    refillRate: 10,
    refillInterval: 1000,
  },
});
```

---

## 💡 Tips & Best Practices

### 1. Keep Notifications Relevant

- Only send notifications users want
- Allow users to customize notification preferences
- Don't spam - respect user attention

### 2. Test Thoroughly

- Test on multiple browsers
- Test on mobile devices
- Test with slow network connections
- Test notification click behavior

### 3. Handle Errors Gracefully

- Always catch and log errors
- Provide fallback mechanisms
- Monitor error rates
- Set up alerts for critical failures

### 4. Optimize Performance

- Use batch sending for multiple users
- Configure appropriate concurrency limits
- Monitor database performance
- Use connection pooling for databases

### 5. Security

- Never expose VAPID private key
- Validate all user inputs
- Use HTTPS in production
- Implement authentication for API endpoints
- Rate limit API requests

---

## 🎉 Success!

You've successfully built a complete push notification system using @allmightypush!

### What You've Learned

✅ How to install and configure the library  
✅ How to generate VAPID keys  
✅ How to create a web server with Express  
✅ How to implement subscription management  
✅ How to send push notifications  
✅ How to handle Service Workers  
✅ How to broadcast to multiple users  
✅ How to monitor statistics  

### Next Steps

1. **Customize the UI** - Make it match your brand
2. **Add authentication** - Secure your API endpoints
3. **Deploy to production** - Use Vercel, Heroku, or your own server
4. **Add more features** - User preferences, notification history, etc.
5. **Monitor performance** - Set up analytics and monitoring
6. **Scale up** - Use PostgreSQL/MongoDB and multiple workers

---

## 📞 Support

- **GitHub Issues**: [Report bugs](https://github.com/Samtes64/all-mighty-push/issues)
- **npm Package**: [@allmightypush/push](https://www.npmjs.com/package/@allmightypush/push)
- **Documentation**: Check package READMEs on npm

---

## 📄 License

MIT License - feel free to use in your projects!

---

**Built with ❤️ using @allmightypush**

Happy coding! 🚀

