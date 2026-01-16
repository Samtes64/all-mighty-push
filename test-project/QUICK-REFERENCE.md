# Quick Reference Card

## 🚀 Setup (Choose One Method)

### Automated Setup
```bash
cd test-project
./setup.sh          # Linux/Mac
setup.bat           # Windows
```

### Manual Setup
```bash
# 1. Build library
cd .. && npm install && npm run build --workspaces

# 2. Setup project
cd test-project && npm install

# 3. Generate keys
node ../packages/push-cli/dist/cjs/cli.js generate-keys

# 4. Create .env
cp .env.example .env
# Edit .env and add keys

# 5. Start
npm start
```

## 🎯 Commands

```bash
npm start           # Start server
npm run worker      # Start retry worker
npm run dev         # Start in dev mode
```

## 🌐 URLs

```
Web Interface:  http://localhost:3000
API Base:       http://localhost:3000/api
```

## 📡 API Endpoints

```
GET    /api/vapid-public-key
POST   /api/push/subscriptions
GET    /api/push/subscriptions
GET    /api/push/subscriptions/:id
PATCH  /api/push/subscriptions/:id
DELETE /api/push/subscriptions/:id
POST   /api/send-notification
POST   /api/broadcast
GET    /api/stats
```

## 🧪 Quick Test

1. Open http://localhost:3000
2. Click "Subscribe to Notifications"
3. Allow notifications
4. Click "Send to Me"
5. ✅ Receive notification!

## 🔧 Environment Variables

```env
VAPID_PUBLIC_KEY=...      # Required
VAPID_PRIVATE_KEY=...     # Required
VAPID_SUBJECT=mailto:...  # Required
PORT=3000                 # Optional
DATABASE_PATH=./push.db   # Optional
```

## 📊 File Locations

```
server.js           # Main server
worker.js           # Retry worker
.env                # Configuration
push.db             # SQLite database
public/index.html   # Web interface
public/app.js       # Client code
public/sw.js        # Service Worker
```

## 🐛 Common Issues

### "Cannot find module"
```bash
cd .. && npm run build --workspaces
```

### "VAPID keys missing"
```bash
node ../packages/push-cli/dist/cjs/cli.js generate-keys
# Add keys to .env
```

### "Port in use"
```bash
# Change PORT in .env
PORT=3001
```

### "Notifications not appearing"
- Check browser permissions
- Disable Do Not Disturb
- Check browser console (F12)

## 💡 Code Snippets

### Send Notification
```javascript
await pushCore.sendNotification(subscription, {
  title: 'Hello',
  body: 'Message',
  icon: '/icon.png',
});
```

### Broadcast
```javascript
const subs = await storage.findSubscriptions({ status: 'active' });
await pushCore.batchSend(subs, { title: 'News', body: 'Update' });
```

### Subscribe (Client)
```javascript
const reg = await navigator.serviceWorker.register('/sw.js');
const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: vapidKey,
});
```

## 📚 Documentation

- `SETUP-GUIDE.md` - Detailed setup
- `README.md` - Project overview
- `../README.md` - Library docs

## ✅ Success Checklist

- [ ] Node.js 16+ installed
- [ ] Packages built
- [ ] VAPID keys generated
- [ ] .env file created
- [ ] Server running
- [ ] Browser opened
- [ ] Subscribed
- [ ] Notification received

## 🎓 Learning Path

1. Run test project
2. Read server.js
3. Read public/app.js
4. Read public/sw.js
5. Try different scenarios
6. Explore API endpoints
7. Check worker.js
8. Read main library docs

## 🚀 Production Checklist

- [ ] Use HTTPS
- [ ] Use PostgreSQL/MongoDB
- [ ] Add authentication
- [ ] Implement rate limiting
- [ ] Set up monitoring
- [ ] Use process manager
- [ ] Configure logging
- [ ] Deploy worker separately

## 📞 Support

- Check SETUP-GUIDE.md
- Check browser console
- Check server logs
- Verify .env file
- Ensure packages built

---

**Quick Start**: `./setup.sh && npm start`
**Documentation**: See SETUP-GUIDE.md
**Help**: Check troubleshooting section
