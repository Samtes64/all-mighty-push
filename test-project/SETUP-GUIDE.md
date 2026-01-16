# 🚀 Complete Setup Guide

This guide will walk you through setting up both the push notification library and the test project.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Part 1: Build the Library](#part-1-build-the-library)
3. [Part 2: Setup Test Project](#part-2-setup-test-project)
4. [Part 3: Run the Application](#part-3-run-the-application)
5. [Part 4: Test Push Notifications](#part-4-test-push-notifications)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **Node.js** version 16 or higher
- **npm** (comes with Node.js)
- A modern web browser (Chrome, Firefox, Edge, or Safari)
- Terminal/Command Prompt access

Check your versions:

```bash
node --version  # Should be v16.0.0 or higher
npm --version   # Should be 7.0.0 or higher
```

---

## Part 1: Build the Library

### Step 1.1: Navigate to the Root Directory

```bash
# If you're in the test-project folder, go back to root
cd ..

# You should now be in the root directory containing 'packages' folder
ls
# You should see: packages, test-project, README.md, etc.
```

### Step 1.2: Install Dependencies

```bash
npm install
```

This will install all dependencies for all packages in the monorepo.

**Expected output:**
```
added XXX packages in XXs
```

### Step 1.3: Build All Packages

```bash
npm run build --workspaces
```

This builds all packages (push-core, push-webpush, push-storage-sqlite, push-express, etc.)

**Expected output:**
```
> @allmightypush/push-core@1.0.0 build
> npm run build:cjs && npm run build:esm && npm run build:types

... (build output for each package)
```

**This step is crucial!** The test project imports from the built packages.

### Step 1.4: Verify Build

Check that the dist folders were created:

```bash
ls packages/push-core/dist
# Should show: cjs, esm, types

ls packages/push-webpush/dist
# Should show: cjs, esm, types

ls packages/push-storage-sqlite/dist
# Should show: cjs, esm, types

ls packages/push-express/dist
# Should show: cjs, esm, types
```

---

## Part 2: Setup Test Project

### Step 2.1: Navigate to Test Project

```bash
cd test-project
```

### Step 2.2: Install Test Project Dependencies

```bash
npm install
```

**Expected output:**
```
added XX packages in Xs
```

### Step 2.3: Generate VAPID Keys

You need VAPID keys for Web Push authentication. Generate them using the CLI:

```bash
# From the test-project directory
node ../packages/push-cli/dist/cjs/cli.js generate-keys
```

**Expected output:**
```
Public Key:  BDd...
Private Key: ...
```

**Important:** Copy these keys! You'll need them in the next step.

### Step 2.4: Create Environment File

Create a `.env` file in the test-project directory:

```bash
cp .env.example .env
```

Now edit the `.env` file and add your VAPID keys:

```bash
# Use your favorite text editor
nano .env
# or
vim .env
# or open in VS Code
code .env
```

Replace the placeholder values with your generated keys:

```env
VAPID_PUBLIC_KEY=BDd...your-public-key...
VAPID_PRIVATE_KEY=...your-private-key...
VAPID_SUBJECT=mailto:admin@example.com

PORT=3000
DATABASE_PATH=./push.db
```

**Save the file!**

### Step 2.5: Initialize Database

The database will be created automatically when you start the server, but you can also create it manually:

```bash
node ../packages/push-cli/dist/cjs/cli.js migrate --database ./push.db
```

**Expected output:**
```
✓ SQLite migrations completed: ./push.db
```

---

## Part 3: Run the Application

### Step 3.1: Start the Server

In the test-project directory:

```bash
npm start
```

**Expected output:**
```
✓ Storage adapter initialized
✓ Web Push provider initialized
✓ PushCore configured
✓ Express middleware mounted at /api/push

============================================================
🚀 Push Notification Test Server
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

**Keep this terminal window open!** The server needs to keep running.

### Step 3.2: (Optional) Start the Worker

Open a **new terminal window** and navigate to test-project:

```bash
cd test-project
npm run worker
```

**Expected output:**
```
============================================================
🔄 Push Notification Retry Worker
============================================================
✓ Storage adapter initialized
✓ Web Push provider initialized
✓ Retry worker configured

Starting worker...
Press Ctrl+C to stop
============================================================

✓ Worker is running
```

**Note:** The worker is optional for basic testing. It processes failed notifications and retries them automatically.

---

## Part 4: Test Push Notifications

### Step 4.1: Open the Web Interface

Open your web browser and go to:

```
http://localhost:3000
```

You should see a beautiful purple gradient page with the title "🔔 Push Notification Test"

### Step 4.2: Subscribe to Notifications

1. Click the **"Subscribe to Notifications"** button
2. Your browser will ask for permission to show notifications
3. Click **"Allow"** or **"Yes"**
4. Wait a few seconds while the subscription is created
5. You should see: "✅ Successfully subscribed to push notifications!"

**What just happened:**
- Service Worker was registered
- Browser subscribed to push notifications
- Subscription was saved to the SQLite database
- You can now receive push notifications!

### Step 4.3: Send a Test Notification

1. In the "📤 Send Test Notification" section, you can customize:
   - **Title**: The notification title
   - **Body**: The notification message

2. Click **"Send to Me"**

3. You should see a push notification appear on your screen! 🎉

**Notification appearance:**
- **Desktop**: Top-right corner (Windows/Linux) or top-right (macOS)
- **Mobile**: Standard notification area

### Step 4.4: Test Broadcasting

1. Open the same page in **multiple browser tabs** or **different browsers**
2. Subscribe to notifications in each tab/browser
3. In one tab, click **"Broadcast to All"**
4. All subscribed tabs/browsers will receive the notification!

### Step 4.5: Check Statistics

The statistics panel shows:
- **Total Subscriptions**: All subscriptions in the database
- **Active**: Currently active subscriptions
- **Queue Pending**: Notifications waiting to be retried
- **Queue Failed**: Failed notifications

Click **"Refresh Stats"** to update the numbers.

---

## Testing Different Scenarios

### Test 1: Basic Notification

```
Title: Hello World
Body: This is my first push notification!
```

Click "Send to Me" → You should receive the notification

### Test 2: Rich Notification

```
Title: 🎉 Special Offer!
Body: Get 50% off on all items. Limited time only!
```

Click "Send to Me" → Notification with emoji

### Test 3: Broadcast

1. Open 3 browser tabs
2. Subscribe in all tabs
3. In one tab, send a broadcast
4. All 3 tabs receive the notification

### Test 4: Unsubscribe and Resubscribe

1. Click "Unsubscribe"
2. Try to send a notification (button should be disabled)
3. Click "Subscribe to Notifications" again
4. Send a notification (should work again)

---

## API Testing with curl

You can also test the API directly:

### Get VAPID Public Key

```bash
curl http://localhost:3000/api/vapid-public-key
```

### List All Subscriptions

```bash
curl http://localhost:3000/api/push/subscriptions
```

### Get Statistics

```bash
curl http://localhost:3000/api/stats
```

### Send Notification (replace SUBSCRIPTION_ID)

```bash
curl -X POST http://localhost:3000/api/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "YOUR_SUBSCRIPTION_ID",
    "title": "API Test",
    "body": "Sent via curl!"
  }'
```

### Broadcast to All

```bash
curl -X POST http://localhost:3000/api/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Broadcast Test",
    "body": "Sent to everyone!"
  }'
```

---

## Troubleshooting

### Issue: "Service Workers are not supported"

**Solution:** Use a modern browser (Chrome, Firefox, Edge, Safari). Service Workers require HTTPS or localhost.

### Issue: "Cannot find module '../packages/push-core/dist/cjs/index.js'"

**Solution:** You need to build the packages first!

```bash
cd ..  # Go to root directory
npm run build --workspaces
cd test-project
npm start
```

### Issue: "VAPID keys are missing"

**Solution:** Make sure you created the `.env` file with valid VAPID keys:

```bash
# Generate new keys
node ../packages/push-cli/dist/cjs/cli.js generate-keys

# Copy keys to .env file
nano .env
```

### Issue: Notifications not appearing

**Possible causes:**

1. **Permission denied**: Check browser notification settings
   - Chrome: Settings → Privacy and security → Site Settings → Notifications
   - Firefox: Preferences → Privacy & Security → Permissions → Notifications

2. **Do Not Disturb mode**: Disable system Do Not Disturb
   - macOS: System Preferences → Notifications
   - Windows: Settings → System → Focus assist

3. **Browser notifications disabled**: Enable in browser settings

### Issue: "Error: listen EADDRINUSE: address already in use :::3000"

**Solution:** Port 3000 is already in use. Either:

1. Stop the other process using port 3000
2. Change the port in `.env`:
   ```env
   PORT=3001
   ```

### Issue: Database errors

**Solution:** Delete and recreate the database:

```bash
rm push.db
node ../packages/push-cli/dist/cjs/cli.js migrate --database ./push.db
npm start
```

### Issue: Worker not processing retries

**Solution:** Make sure:

1. Worker is running (`npm run worker`)
2. There are failed notifications in the queue
3. Check worker terminal for error messages

---

## Advanced Usage

### Using PostgreSQL Instead of SQLite

1. Install PostgreSQL
2. Create a database:
   ```sql
   CREATE DATABASE push_notifications;
   ```

3. Update `server.js` to use PostgreSQL adapter:
   ```javascript
   const { PostgreSQLStorageAdapter } = require('../packages/push-storage-postgres/dist/cjs/index.js');
   
   const storage = new PostgreSQLStorageAdapter({
     host: 'localhost',
     port: 5432,
     database: 'push_notifications',
     user: 'postgres',
     password: 'your-password',
   });
   ```

### Using MongoDB Instead of SQLite

1. Install MongoDB
2. Update `server.js` to use MongoDB adapter:
   ```javascript
   const { MongoDBStorageAdapter } = require('../packages/push-storage-mongo/dist/cjs/index.js');
   
   const storage = new MongoDBStorageAdapter({
     uri: 'mongodb://localhost:27017',
     database: 'push_notifications',
   });
   ```

### Deploying to Production

1. Use HTTPS (required for Service Workers)
2. Use PostgreSQL or MongoDB for production
3. Set up proper environment variables
4. Run worker as a separate process/container
5. Use a process manager (PM2, systemd)
6. Set up monitoring and logging

---

## Next Steps

Now that you have the test project running:

1. ✅ Explore the code in `server.js` to understand the API
2. ✅ Check `public/app.js` to see client-side implementation
3. ✅ Read the main library documentation in `../README.md`
4. ✅ Try different storage adapters (PostgreSQL, MongoDB)
5. ✅ Integrate into your own application

---

## Quick Reference

### Start Server
```bash
cd test-project
npm start
```

### Start Worker
```bash
cd test-project
npm run worker
```

### Generate VAPID Keys
```bash
node ../packages/push-cli/dist/cjs/cli.js generate-keys
```

### Run Migrations
```bash
node ../packages/push-cli/dist/cjs/cli.js migrate --database ./push.db
```

### Rebuild Library
```bash
cd ..
npm run build --workspaces
```

---

## Support

If you encounter any issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review the console output for error messages
3. Check browser console (F12) for client-side errors
4. Verify all prerequisites are met
5. Ensure all packages are built correctly

---

## Success Checklist

- [ ] Node.js 16+ installed
- [ ] All packages built (`npm run build --workspaces`)
- [ ] VAPID keys generated
- [ ] `.env` file created with valid keys
- [ ] Server running on http://localhost:3000
- [ ] Browser opened to http://localhost:3000
- [ ] Subscribed to notifications
- [ ] Received test notification
- [ ] Statistics showing correct numbers

If all items are checked, congratulations! 🎉 You've successfully set up the push notification library!

---

**Happy Testing! 🚀**
