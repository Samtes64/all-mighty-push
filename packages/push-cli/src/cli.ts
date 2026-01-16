#!/usr/bin/env node

import { Command } from 'commander';
import { generateVapidKeys } from '@allmightypush/push-core';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('push-cli')
  .description('Command-line tools for push notification library')
  .version('1.0.0');

/**
 * init command - Create configuration file
 */
program
  .command('init')
  .description('Create a push notification configuration file')
  .option('-o, --output <path>', 'Output file path', 'push.config.js')
  .action((options) => {
    const configTemplate = `module.exports = {
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
`;

    try {
      fs.writeFileSync(options.output, configTemplate, 'utf8');
      console.log(`✓ Configuration file created: ${options.output}`);
      console.log('  Remember to generate VAPID keys with: push-cli generate-keys');
    } catch (error: any) {
      console.error(`✗ Failed to create configuration file: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * generate-keys command - Generate VAPID keys
 */
program
  .command('generate-keys')
  .description('Generate VAPID keys for push notifications')
  .option('-o, --output <path>', 'Output file path (optional)')
  .option('-f, --format <format>', 'Output format: json, env, or text', 'text')
  .action((options) => {
    try {
      const keys = generateVapidKeys();

      let output: string;

      switch (options.format) {
        case 'json':
          output = JSON.stringify(keys, null, 2);
          break;
        case 'env':
          output = `VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}`;
          break;
        case 'text':
        default:
          output = `Public Key:  ${keys.publicKey}\nPrivate Key: ${keys.privateKey}`;
          break;
      }

      if (options.output) {
        fs.writeFileSync(options.output, output, 'utf8');
        console.log(`✓ VAPID keys saved to: ${options.output}`);
      } else {
        console.log(output);
      }

      if (options.format === 'text' && !options.output) {
        console.log('\n⚠ Keep these keys secure! Add them to your configuration file or environment variables.');
      }
    } catch (error: any) {
      console.error(`✗ Failed to generate VAPID keys: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * migrate command - Run database migrations
 */
program
  .command('migrate')
  .description('Run database migrations')
  .option('-d, --database <path>', 'Database file path (SQLite)', './push.db')
  .option('-t, --type <type>', 'Database type: sqlite, postgres, or mongo', 'sqlite')
  .option('-u, --uri <uri>', 'Database connection URI (for postgres/mongo)')
  .action(async (options) => {
    try {
      let storage: any;

      switch (options.type) {
        case 'sqlite': {
          const { SQLiteStorageAdapter } = await import('@allmightypush/push-storage-sqlite');
          storage = new SQLiteStorageAdapter({ filename: options.database });
          console.log(`✓ SQLite migrations completed: ${options.database}`);
          break;
        }
        case 'postgres': {
          if (!options.uri) {
            console.error('✗ PostgreSQL URI is required. Use --uri option.');
            process.exit(1);
          }
          const { PostgreSQLStorageAdapter } = await import('@allmightypush/push-storage-postgres');
          storage = new PostgreSQLStorageAdapter({ connectionString: options.uri });
          await storage.migrate();
          await storage.close();
          console.log('✓ PostgreSQL migrations completed');
          break;
        }
        case 'mongo': {
          if (!options.uri) {
            console.error('✗ MongoDB URI is required. Use --uri option.');
            process.exit(1);
          }
          const MongoDBModule = await import('@allmightypush/push-storage-mongo');
          // @ts-ignore - Dynamic import
          const MongoDBStorageAdapter = MongoDBModule.default || MongoDBModule.MongoDBStorageAdapter || MongoDBModule;
          const dbName = options.database || 'push';
          storage = new MongoDBStorageAdapter({ uri: options.uri, database: dbName });
          await storage.migrate();
          await storage.close();
          console.log('✓ MongoDB migrations completed');
          break;
        }
        default:
          console.error(`✗ Unknown database type: ${options.type}`);
          process.exit(1);
      }
    } catch (error: any) {
      console.error(`✗ Migration failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * send-test command - Send a test notification
 */
program
  .command('send-test')
  .description('Send a test notification to a subscription')
  .requiredOption('-e, --endpoint <url>', 'Push service endpoint URL')
  .requiredOption('-p, --p256dh <key>', 'P256DH public key')
  .requiredOption('-a, --auth <key>', 'Auth secret')
  .option('--public-key <key>', 'VAPID public key')
  .option('--private-key <key>', 'VAPID private key')
  .option('--subject <email>', 'VAPID subject (mailto: email)')
  .option('-t, --title <title>', 'Notification title', 'Test Notification')
  .option('-b, --body <body>', 'Notification body', 'This is a test notification')
  .option('-i, --icon <url>', 'Notification icon URL')
  .action(async (options) => {
    try {
      if (!options.publicKey || !options.privateKey || !options.subject) {
        console.error('✗ VAPID keys are required. Use --public-key, --private-key, and --subject options.');
        process.exit(1);
      }

      const { WebPushProvider } = await import('@allmightypush/push-webpush');

      const provider = new WebPushProvider({
        vapidPublicKey: options.publicKey,
        vapidPrivateKey: options.privateKey,
        vapidSubject: options.subject,
      });

      const subscription = {
        id: 'test-subscription',
        endpoint: options.endpoint,
        keys: {
          p256dh: options.p256dh,
          auth: options.auth,
        },
        status: 'active' as const,
        failedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const payload = {
        title: options.title,
        body: options.body,
        icon: options.icon,
      };

      console.log('Sending test notification...');
      const result = await provider.send(subscription, payload, {});

      if (result.success) {
        console.log('✓ Notification sent successfully!');
      } else {
        console.error(`✗ Failed to send notification: ${result.error?.message}`);
        process.exit(1);
      }
    } catch (error: any) {
      console.error(`✗ Failed to send test notification: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * worker command - Start worker process
 */
program
  .command('worker')
  .description('Start the retry worker process')
  .option('-c, --config <path>', 'Configuration file path', 'push.config.js')
  .option('-d, --database <path>', 'Database file path (SQLite)', './push.db')
  .option('-t, --type <type>', 'Database type: sqlite, postgres, or mongo', 'sqlite')
  .option('-u, --uri <uri>', 'Database connection URI (for postgres/mongo)')
  .action(async (options) => {
    try {
      let config: any = {};

      // Load configuration file if it exists
      if (fs.existsSync(options.config)) {
        const configPath = path.resolve(options.config);
        config = require(configPath);
        console.log(`✓ Loaded configuration from: ${options.config}`);
      }

      // Initialize storage adapter
      let storage: any;

      switch (options.type) {
        case 'sqlite': {
          const { SQLiteStorageAdapter } = await import('@allmightypush/push-storage-sqlite');
          storage = new SQLiteStorageAdapter({ filename: options.database });
          break;
        }
        case 'postgres': {
          if (!options.uri) {
            console.error('✗ PostgreSQL URI is required. Use --uri option.');
            process.exit(1);
          }
          const { PostgreSQLStorageAdapter } = await import('@allmightypush/push-storage-postgres');
          storage = new PostgreSQLStorageAdapter({ connectionString: options.uri });
          break;
        }
        case 'mongo': {
          if (!options.uri) {
            console.error('✗ MongoDB URI is required. Use --uri option.');
            process.exit(1);
          }
          const MongoDBModule = await import('@allmightypush/push-storage-mongo');
          // @ts-ignore - Dynamic import
          const MongoDBStorageAdapter = MongoDBModule.default || MongoDBModule.MongoDBStorageAdapter || MongoDBModule;
          const dbName = options.database || 'push';
          storage = new MongoDBStorageAdapter({ uri: options.uri, database: dbName });
          break;
        }
        default:
          console.error(`✗ Unknown database type: ${options.type}`);
          process.exit(1);
      }

      // Initialize provider
      const { WebPushProvider } = await import('@allmightypush/push-webpush');
      const provider = new WebPushProvider({
        vapidPublicKey: config.vapidKeys?.publicKey || process.env.VAPID_PUBLIC_KEY,
        vapidPrivateKey: config.vapidKeys?.privateKey || process.env.VAPID_PRIVATE_KEY,
        vapidSubject: config.vapidKeys?.subject || process.env.VAPID_SUBJECT,
      });

      // Initialize worker
      const { RetryWorker } = await import('@allmightypush/push-core');
      const worker = new RetryWorker(storage, provider, config.retryPolicy || {});

      console.log('✓ Starting retry worker...');
      await worker.start();

      console.log('✓ Worker is running. Press Ctrl+C to stop.');

      // Handle graceful shutdown
      process.on('SIGTERM', async () => {
        console.log('\n⚠ Received SIGTERM, shutting down gracefully...');
        await worker.stop();
        await storage.close();
        process.exit(0);
      });

      process.on('SIGINT', async () => {
        console.log('\n⚠ Received SIGINT, shutting down gracefully...');
        await worker.stop();
        await storage.close();
        process.exit(0);
      });
    } catch (error: any) {
      console.error(`✗ Worker failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * doctor command - Run sanity checks
 */
program
  .command('doctor')
  .description('Run sanity checks on configuration and environment')
  .option('-c, --config <path>', 'Configuration file path', 'push.config.js')
  .option('-d, --database <path>', 'Database file path (SQLite)', './push.db')
  .action(async (options) => {
    console.log('Running sanity checks...\n');

    let hasErrors = false;

    // Check configuration file
    if (fs.existsSync(options.config)) {
      console.log(`✓ Configuration file exists: ${options.config}`);
      try {
        const configPath = path.resolve(options.config);
        const config = require(configPath);

        // Check VAPID keys
        if (config.vapidKeys?.publicKey && config.vapidKeys?.privateKey) {
          console.log('✓ VAPID keys are configured');
        } else {
          console.log('✗ VAPID keys are missing in configuration');
          hasErrors = true;
        }

        // Check storage configuration
        if (config.storage) {
          console.log(`✓ Storage configuration found: ${config.storage.type || 'unknown'}`);
        } else {
          console.log('⚠ Storage configuration not found (using defaults)');
        }
      } catch (error: any) {
        console.log(`✗ Failed to load configuration: ${error.message}`);
        hasErrors = true;
      }
    } else {
      console.log(`⚠ Configuration file not found: ${options.config}`);
      console.log('  Run "push-cli init" to create one');
    }

    // Check database file (SQLite)
    if (fs.existsSync(options.database)) {
      console.log(`✓ Database file exists: ${options.database}`);
    } else {
      console.log(`⚠ Database file not found: ${options.database}`);
      console.log('  Run "push-cli migrate" to create it');
    }

    // Check environment variables
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      console.log('✓ VAPID keys found in environment variables');
    } else {
      console.log('⚠ VAPID keys not found in environment variables');
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    if (majorVersion >= 16) {
      console.log(`✓ Node.js version is compatible: ${nodeVersion}`);
    } else {
      console.log(`✗ Node.js version is too old: ${nodeVersion} (requires >= 16.0.0)`);
      hasErrors = true;
    }

    console.log('');

    if (hasErrors) {
      console.log('✗ Some checks failed. Please fix the issues above.');
      process.exit(1);
    } else {
      console.log('✓ All checks passed!');
    }
  });

program.parse();
