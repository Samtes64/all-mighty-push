# Getting Started with @allmightypush

Complete guide to using the push notification library.

## 🎯 Choose Your Path

### Path 1: Try the Test Project (Recommended for Beginners)

**Best for**: Learning, testing, seeing it in action

```bash
cd test-project
./setup.sh          # Linux/Mac
# or
setup.bat           # Windows

npm start
# Open http://localhost:3000
```

📖 **Documentation**: `test-project/SETUP-GUIDE.md`

### Path 2: Use in Your Project (For Production)

**Best for**: Integrating into existing applications

```bash
npm install @allmightypush/push @allmightypush/push-storage-sqlite @allmightypush/push-webpush
```

📖 **Documentation**: `QUICK-START-GUIDE.md`

### Path 3: Explore the Library (For Developers)

**Best for**: Understanding the implementation

```bash
npm install
npm run build --workspaces
npm test
```

📖 **Documentation**: `README.md`, package READMEs

## 📚 Documentation Index

### For Beginners

1. **test-project/SETUP-GUIDE.md** - Complete step-by-step setup
2. **test-project/README.md** - Test project overview
3. **test-project/QUICK-REFERENCE.md** - Quick commands

### For Developers

1. **README.md** - Main library documentation
2. **QUICK-START-GUIDE.md** - Quick integration guide
3. **packages/*/README.md** - Package-specific docs

### For Reference

1. **FINAL-PROJECT-STATUS.md** - Complete project status
2. **TASKS-16-18-COMPLETION.md** - Recent additions
3. **TEST-PROJECT-SUMMARY.md** - Test project details

## 🚀 Quick Start Options

### Option 1: Test Project (5 minutes)

```bash
cd test-project
./setup.sh
npm start
# Open http://localhost:3000
```

### Option 2: New Project (10 minutes)

```bash
# 1. Install
npm install @allmightypush/push

# 2. Generate keys
npx @allmightypush/push-cli generate-keys

# 3. Use in code
import { PushCore, generateVapidKeys } from '@allmightypush/push';
// See QUICK-START-GUIDE.md for full example
```

### Option 3: Explore Library (15 minutes)

```bash
# 1. Build
npm install
npm run build --workspaces

# 2. Test
npm test

# 3. Explore
ls packages/
cat README.md
```

## 🎓 Learning Path

### Beginner Path

1. ✅ Run test project
2. ✅ Subscribe to notifications
3. ✅ Send test notification
4. ✅ Read test-project/server.js
5. ✅ Read test-project/public/app.js
6. ✅ Try different scenarios

### Intermediate Path

1. ✅ Read QUICK-START-GUIDE.md
2. ✅ Create new project
3. ✅ Integrate library
4. ✅ Implement subscription flow
5. ✅ Send notifications
6. ✅ Add worker process

### Advanced Path

1. ✅ Read main README.md
2. ✅ Explore package source code
3. ✅ Try different storage adapters
4. ✅ Implement custom provider
5. ✅ Add monitoring
6. ✅ Deploy to production

## 📦 Package Overview

### Core Packages

- **@allmightypush/push-core** - Core functionality
- **@allmightypush/push-webpush** - Web Push provider
- **@allmightypush/push** - Meta package (includes core + SQLite)

### Storage Adapters

- **@allmightypush/push-storage-sqlite** - SQLite (included in meta)
- **@allmightypush/push-storage-postgres** - PostgreSQL
- **@allmightypush/push-storage-mongo** - MongoDB

### Tools

- **@allmightypush/push-express** - Express middleware
- **@allmightypush/push-cli** - Command-line tools

## 🔧 Setup Methods

### Method 1: Automated (Easiest)

```bash
cd test-project
./setup.sh  # Does everything for you
npm start
```

### Method 2: CLI-Assisted

```bash
npm install @allmightypush/push-cli -g
push-cli init
push-cli generate-keys
push-cli migrate
push-cli worker
```

### Method 3: Manual

```bash
npm install @allmightypush/push
# Write your own code
# See QUICK-START-GUIDE.md
```

## 🎯 Use Cases

### Use Case 1: Simple Notifications

```javascript
import { PushCore } from '@allmightypush/push';

const pushCore = new PushCore();
pushCore.configure({ /* config */ });

await pushCore.sendNotification(subscription, {
  title: 'Hello',
  body: 'World',
});
```

### Use Case 2: With Express API

```javascript
import express from 'express';
import { createExpressMiddleware } from '@allmightypush/push-express';

const app = express();
app.use('/api/push', createExpressMiddleware({ storageAdapter }));
```

### Use Case 3: With Worker

```javascript
import { RetryWorker } from '@allmightypush/push';

const worker = new RetryWorker(storage, provider, config);
await worker.start();
```

## 🐛 Troubleshooting

### Issue: "Cannot find module"

**Solution**: Build the packages first

```bash
npm run build --workspaces
```

### Issue: "VAPID keys missing"

**Solution**: Generate keys

```bash
npx @allmightypush/push-cli generate-keys
```

### Issue: "Notifications not appearing"

**Solution**: Check browser permissions and Do Not Disturb mode

### More Help

See `test-project/SETUP-GUIDE.md` for comprehensive troubleshooting.

## 📞 Support

- **Test Project Issues**: See `test-project/SETUP-GUIDE.md`
- **Library Issues**: See `README.md`
- **API Reference**: See package READMEs
- **Examples**: See `test-project/` and `QUICK-START-GUIDE.md`

## ✅ Success Checklist

### For Test Project

- [ ] Node.js 16+ installed
- [ ] Packages built
- [ ] Test project setup complete
- [ ] Server running
- [ ] Browser opened
- [ ] Subscribed to notifications
- [ ] Received test notification

### For Your Project

- [ ] Library installed
- [ ] VAPID keys generated
- [ ] Storage adapter configured
- [ ] PushCore configured
- [ ] Subscriptions working
- [ ] Notifications sending
- [ ] Worker running (optional)

## 🎉 Next Steps

After getting started:

1. ✅ Explore the test project
2. ✅ Read the documentation
3. ✅ Try different storage adapters
4. ✅ Implement in your application
5. ✅ Deploy to production

## 📖 Documentation Map

```
Root Level:
├── README.md                    # Main library docs
├── GETTING-STARTED.md          # This file
├── QUICK-START-GUIDE.md        # Quick integration
├── FINAL-PROJECT-STATUS.md     # Project status
└── TEST-PROJECT-SUMMARY.md     # Test project summary

Test Project:
├── test-project/SETUP-GUIDE.md      # Step-by-step setup
├── test-project/README.md           # Project overview
└── test-project/QUICK-REFERENCE.md  # Quick reference

Packages:
├── packages/push/README.md          # Meta package
├── packages/push-core/README.md     # Core library
├── packages/push-express/README.md  # Express middleware
├── packages/push-cli/README.md      # CLI tool
└── packages/push-*/README.md        # Other packages
```

## 🚀 Recommended Starting Point

**For most users, we recommend:**

1. Start with the **test project** to see it in action
2. Read the **test-project/SETUP-GUIDE.md**
3. Follow the automated setup
4. Test push notifications
5. Read the code to understand how it works
6. Integrate into your own project

**Time required**: 15-30 minutes

---

**Ready to start?** → `cd test-project && ./setup.sh`

**Need help?** → See `test-project/SETUP-GUIDE.md`

**Want to dive deep?** → See `README.md`

