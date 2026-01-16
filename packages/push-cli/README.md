# @allmightypush/push-cli

Command-line interface tools for the push notification library.

## Installation

```bash
npm install -g @allmightypush/push-cli
```

Or use with npx:

```bash
npx @allmightypush/push-cli <command>
```

## Commands

### init

Create a push notification configuration file.

```bash
push-cli init [options]

Options:
  -o, --output <path>  Output file path (default: "push.config.js")
```

Example:

```bash
push-cli init
push-cli init --output config/push.js
```

### generate-keys

Generate VAPID keys for push notifications.

```bash
push-cli generate-keys [options]

Options:
  -o, --output <path>     Output file path (optional)
  -f, --format <format>   Output format: json, env, or text (default: "text")
```

Examples:

```bash
# Print to console
push-cli generate-keys

# Save to file
push-cli generate-keys --output vapid-keys.json --format json

# Generate .env format
push-cli generate-keys --output .env.vapid --format env
```

### migrate

Run database migrations.

```bash
push-cli migrate [options]

Options:
  -d, --database <path>  Database file path (SQLite) (default: "./push.db")
  -t, --type <type>      Database type: sqlite, postgres, or mongo (default: "sqlite")
  -u, --uri <uri>        Database connection URI (for postgres/mongo)
```

Examples:

```bash
# SQLite
push-cli migrate --database ./push.db

# PostgreSQL
push-cli migrate --type postgres --uri postgresql://user:pass@localhost:5432/push

# MongoDB
push-cli migrate --type mongo --uri mongodb://localhost:27017 --database push_notifications
```

### send-test

Send a test notification to a subscription.

```bash
push-cli send-test [options]

Required Options:
  -e, --endpoint <url>      Push service endpoint URL
  -p, --p256dh <key>        P256DH public key
  -a, --auth <key>          Auth secret
  --public-key <key>        VAPID public key
  --private-key <key>       VAPID private key
  --subject <email>         VAPID subject (mailto: email)

Optional:
  -t, --title <title>       Notification title (default: "Test Notification")
  -b, --body <body>         Notification body (default: "This is a test notification")
  -i, --icon <url>          Notification icon URL
```

Example:

```bash
push-cli send-test \
  --endpoint "https://fcm.googleapis.com/fcm/send/..." \
  --p256dh "BNc..." \
  --auth "tBH..." \
  --public-key "BDd..." \
  --private-key "..." \
  --subject "mailto:admin@example.com" \
  --title "Hello" \
  --body "Test message"
```

### worker

Start the retry worker process.

```bash
push-cli worker [options]

Options:
  -c, --config <path>    Configuration file path (default: "push.config.js")
  -d, --database <path>  Database file path (SQLite) (default: "./push.db")
  -t, --type <type>      Database type: sqlite, postgres, or mongo (default: "sqlite")
  -u, --uri <uri>        Database connection URI (for postgres/mongo)
```

Examples:

```bash
# With configuration file
push-cli worker --config push.config.js

# SQLite
push-cli worker --database ./push.db

# PostgreSQL
push-cli worker --type postgres --uri postgresql://user:pass@localhost:5432/push

# MongoDB
push-cli worker --type mongo --uri mongodb://localhost:27017 --database push_notifications
```

The worker will run until you press Ctrl+C. It handles graceful shutdown automatically.

### doctor

Run sanity checks on configuration and environment.

```bash
push-cli doctor [options]

Options:
  -c, --config <path>    Configuration file path (default: "push.config.js")
  -d, --database <path>  Database file path (SQLite) (default: "./push.db")
```

Example:

```bash
push-cli doctor
```

Checks:
- ✓ Configuration file exists and is valid
- ✓ VAPID keys are configured
- ✓ Storage configuration is present
- ✓ Database file exists (SQLite)
- ✓ Environment variables are set
- ✓ Node.js version is compatible

## Configuration File

The `init` command creates a configuration file with this structure:

```javascript
module.exports = {
  vapidKeys: {
    publicKey: 'YOUR_PUBLIC_KEY',
    privateKey: 'YOUR_PRIVATE_KEY',
    subject: 'mailto:your-email@example.com',
  },
  storage: {
    type: 'sqlite',
    filename: './push.db',
  },
  retryPolicy: {
    maxRetries: 8,
    baseDelay: 1000,
    backoffFactor: 2,
    maxDelay: 3600000,
    jitter: true,
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 60000,
  },
  batchConfig: {
    batchSize: 50,
    concurrency: 10,
  },
  worker: {
    pollInterval: 5000,
    concurrency: 10,
    batchSize: 50,
  },
};
```

## Environment Variables

The CLI respects these environment variables:

- `VAPID_PUBLIC_KEY` - VAPID public key
- `VAPID_PRIVATE_KEY` - VAPID private key
- `VAPID_SUBJECT` - VAPID subject (mailto: email)
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` - PostgreSQL connection

## Quick Start

```bash
# 1. Initialize configuration
push-cli init

# 2. Generate VAPID keys
push-cli generate-keys --output vapid-keys.json --format json

# 3. Update push.config.js with the generated keys

# 4. Run migrations
push-cli migrate

# 5. Start the worker
push-cli worker

# 6. (Optional) Run sanity checks
push-cli doctor
```

## Production Deployment

### Systemd Service

Create `/etc/systemd/system/push-worker.service`:

```ini
[Unit]
Description=Push Notification Worker
After=network.target

[Service]
Type=simple
User=push
WorkingDirectory=/opt/push-notifications
ExecStart=/usr/bin/node /opt/push-notifications/node_modules/.bin/push-cli worker
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable push-worker
sudo systemctl start push-worker
sudo systemctl status push-worker
```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

CMD ["npx", "@allmightypush/push-cli", "worker"]
```

## License

MIT
