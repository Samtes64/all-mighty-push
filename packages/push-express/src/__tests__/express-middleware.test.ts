import express, { Express } from 'express';
import request from 'supertest';
import { createExpressMiddleware } from '../index';
import type { StorageAdapter, Subscription } from '@allmightypush/push-core';

// Mock storage adapter
class MockStorageAdapter implements StorageAdapter {
  private subscriptions: Map<string, Subscription> = new Map();
  private idCounter = 1;

  async migrate(): Promise<void> {
    // No-op for mock
  }

  async createSubscription(data: Partial<Subscription>): Promise<Subscription> {
    const id = `sub-${this.idCounter++}`;
    const subscription: Subscription = {
      id,
      endpoint: data.endpoint!,
      keys: data.keys!,
      userId: data.userId,
      status: 'active',
      failedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: data.metadata,
    };
    this.subscriptions.set(id, subscription);
    return subscription;
  }

  async getSubscriptionById(id: string): Promise<Subscription | null> {
    return this.subscriptions.get(id) || null;
  }

  async findSubscriptions(filters?: any): Promise<Subscription[]> {
    let results = Array.from(this.subscriptions.values());

    if (filters?.userId) {
      results = results.filter((s) => s.userId === filters.userId);
    }

    if (filters?.status) {
      results = results.filter((s) => s.status === filters.status);
    }

    return results;
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    const subscription = this.subscriptions.get(id);
    if (subscription) {
      Object.assign(subscription, updates, { updatedAt: new Date() });
      return subscription;
    }
    throw new Error('Subscription not found');
  }

  async deleteSubscription(id: string): Promise<void> {
    this.subscriptions.delete(id);
  }

  async enqueueRetry(): Promise<void> {
    // No-op for mock
  }

  async dequeueRetry(): Promise<any[]> {
    return [];
  }

  async ackRetry(): Promise<void> {
    // No-op for mock
  }

  async getQueueStats(): Promise<any> {
    return { total: 0, pending: 0, processing: 0 };
  }

  async close(): Promise<void> {
    // No-op for mock
  }

  reset() {
    this.subscriptions.clear();
    this.idCounter = 1;
  }
}

describe('Express Middleware', () => {
  let app: Express;
  let storage: MockStorageAdapter;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    app = express();
    app.use(express.json());
    app.use('/api/push', createExpressMiddleware({ storageAdapter: storage }));
  });

  describe('POST /subscriptions', () => {
    it('should create a new subscription', async () => {
      const response = await request(app)
        .post('/api/push/subscriptions')
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test',
          keys: {
            p256dh: 'test-p256dh-key',
            auth: 'test-auth-key',
          },
          userId: 'user-123',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
        userId: 'user-123',
        status: 'active',
      });
    });

    it('should return 400 for missing endpoint', async () => {
      const response = await request(app)
        .post('/api/push/subscriptions')
        .send({
          keys: {
            p256dh: 'test-p256dh-key',
            auth: 'test-auth-key',
          },
        })
        .expect(400);

      expect(response.body.error).toContain('endpoint');
    });

    it('should return 400 for missing keys', async () => {
      const response = await request(app)
        .post('/api/push/subscriptions')
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        })
        .expect(400);

      expect(response.body.error).toContain('keys');
    });

    it('should return 400 for missing keys.p256dh', async () => {
      const response = await request(app)
        .post('/api/push/subscriptions')
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test',
          keys: {
            auth: 'test-auth-key',
          },
        })
        .expect(400);

      expect(response.body.error).toContain('p256dh');
    });

    it('should return 400 for missing keys.auth', async () => {
      const response = await request(app)
        .post('/api/push/subscriptions')
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test',
          keys: {
            p256dh: 'test-p256dh-key',
          },
        })
        .expect(400);

      expect(response.body.error).toContain('auth');
    });

    it('should accept optional metadata', async () => {
      const response = await request(app)
        .post('/api/push/subscriptions')
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test',
          keys: {
            p256dh: 'test-p256dh-key',
            auth: 'test-auth-key',
          },
          metadata: {
            deviceType: 'mobile',
            appVersion: '1.0.0',
          },
        })
        .expect(201);

      expect(response.body.metadata).toEqual({
        deviceType: 'mobile',
        appVersion: '1.0.0',
      });
    });
  });

  describe('GET /subscriptions/:id', () => {
    it('should retrieve a subscription by ID', async () => {
      const created = await storage.createSubscription({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      });

      const response = await request(app)
        .get(`/api/push/subscriptions/${created.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: created.id,
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
      });
    });

    it('should return 404 for non-existent subscription', async () => {
      const response = await request(app)
        .get('/api/push/subscriptions/non-existent')
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('GET /subscriptions', () => {
    beforeEach(async () => {
      await storage.createSubscription({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test1',
        keys: { p256dh: 'key1', auth: 'auth1' },
        userId: 'user-1',
      });

      await storage.createSubscription({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test2',
        keys: { p256dh: 'key2', auth: 'auth2' },
        userId: 'user-1',
      });

      const sub3 = await storage.createSubscription({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test3',
        keys: { p256dh: 'key3', auth: 'auth3' },
        userId: 'user-2',
      });
      
      // Update status to expired
      await storage.updateSubscription(sub3.id, { status: 'expired' });
    });

    it('should list all subscriptions', async () => {
      const response = await request(app)
        .get('/api/push/subscriptions')
        .expect(200);

      expect(response.body.subscriptions).toHaveLength(3);
      expect(response.body.total).toBe(3);
    });

    it('should filter by userId', async () => {
      const response = await request(app)
        .get('/api/push/subscriptions?userId=user-1')
        .expect(200);

      expect(response.body.subscriptions).toHaveLength(2);
      expect(response.body.subscriptions.every((s: any) => s.userId === 'user-1')).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/push/subscriptions?status=expired')
        .expect(200);

      expect(response.body.subscriptions).toHaveLength(1);
      expect(response.body.subscriptions[0].status).toBe('expired');
    });

    it('should support pagination with limit', async () => {
      const response = await request(app)
        .get('/api/push/subscriptions?limit=2')
        .expect(200);

      expect(response.body.subscriptions).toHaveLength(2);
      expect(response.body.limit).toBe(2);
      expect(response.body.total).toBe(3);
    });

    it('should support pagination with offset', async () => {
      const response = await request(app)
        .get('/api/push/subscriptions?offset=2')
        .expect(200);

      expect(response.body.subscriptions).toHaveLength(1);
      expect(response.body.offset).toBe(2);
    });

    it('should combine filters and pagination', async () => {
      const response = await request(app)
        .get('/api/push/subscriptions?userId=user-1&limit=1')
        .expect(200);

      expect(response.body.subscriptions).toHaveLength(1);
      expect(response.body.subscriptions[0].userId).toBe('user-1');
    });
  });

  describe('PATCH /subscriptions/:id', () => {
    it('should update subscription status', async () => {
      const created = await storage.createSubscription({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      const response = await request(app)
        .patch(`/api/push/subscriptions/${created.id}`)
        .send({ status: 'expired' })
        .expect(200);

      expect(response.body.status).toBe('expired');
    });

    it('should update subscription metadata', async () => {
      const created = await storage.createSubscription({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      const response = await request(app)
        .patch(`/api/push/subscriptions/${created.id}`)
        .send({ metadata: { updated: true } })
        .expect(200);

      expect(response.body.metadata).toEqual({ updated: true });
    });

    it('should return 400 for invalid status', async () => {
      const created = await storage.createSubscription({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      const response = await request(app)
        .patch(`/api/push/subscriptions/${created.id}`)
        .send({ status: 'invalid' })
        .expect(400);

      expect(response.body.error).toContain('Invalid status');
    });

    it('should return 404 for non-existent subscription', async () => {
      const response = await request(app)
        .patch('/api/push/subscriptions/non-existent')
        .send({ status: 'expired' })
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('DELETE /subscriptions/:id', () => {
    it('should delete a subscription', async () => {
      const created = await storage.createSubscription({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      await request(app)
        .delete(`/api/push/subscriptions/${created.id}`)
        .expect(204);

      const subscription = await storage.getSubscriptionById(created.id);
      expect(subscription).toBeNull();
    });

    it('should return 404 for non-existent subscription', async () => {
      const response = await request(app)
        .delete('/api/push/subscriptions/non-existent')
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('Authentication middleware', () => {
    it('should apply auth middleware when provided', async () => {
      const authMiddleware = jest.fn((req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
          next();
        } else {
          res.status(401).json({ error: 'Unauthorized' });
        }
      });

      const authApp = express();
      authApp.use(express.json());
      authApp.use(
        '/api/push',
        createExpressMiddleware({
          storageAdapter: storage,
          authMiddleware,
        })
      );

      // Without auth header
      await request(authApp)
        .post('/api/push/subscriptions')
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test',
          keys: { p256dh: 'key', auth: 'auth' },
        })
        .expect(401);

      expect(authMiddleware).toHaveBeenCalled();

      // With valid auth header
      await request(authApp)
        .post('/api/push/subscriptions')
        .set('Authorization', 'Bearer valid-token')
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test',
          keys: { p256dh: 'key', auth: 'auth' },
        })
        .expect(201);
    });
  });

  describe('Custom validation', () => {
    it('should apply custom validation when provided', async () => {
      const validateSubscription = jest.fn(async (data) => {
        if (data.endpoint && !data.endpoint.startsWith('https://')) {
          throw new Error('Endpoint must use HTTPS');
        }
      });

      const validationApp = express();
      validationApp.use(express.json());
      validationApp.use(
        '/api/push',
        createExpressMiddleware({
          storageAdapter: storage,
          validateSubscription,
        })
      );

      // Invalid endpoint
      await request(validationApp)
        .post('/api/push/subscriptions')
        .send({
          endpoint: 'http://example.com/push',
          keys: { p256dh: 'key', auth: 'auth' },
        })
        .expect(400);

      expect(validateSubscription).toHaveBeenCalled();

      // Valid endpoint
      await request(validationApp)
        .post('/api/push/subscriptions')
        .send({
          endpoint: 'https://example.com/push',
          keys: { p256dh: 'key', auth: 'auth' },
        })
        .expect(201);
    });
  });

  describe('Custom base path', () => {
    it('should support custom base path', async () => {
      const customApp = express();
      customApp.use(express.json());
      customApp.use(
        '/api/push',
        createExpressMiddleware({
          storageAdapter: storage,
          basePath: '/v1',
        })
      );

      const response = await request(customApp)
        .post('/api/push/v1/subscriptions')
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test',
          keys: { p256dh: 'key', auth: 'auth' },
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
    });
  });
});
