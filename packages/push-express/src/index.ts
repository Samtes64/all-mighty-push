import type { Request, Response, NextFunction, Router } from 'express';
import type { StorageAdapter, Subscription } from '@allmightypush/push-core';

/**
 * Options for configuring the Express middleware
 */
export interface ExpressMiddlewareOptions {
  /**
   * Storage adapter for managing subscriptions
   */
  storageAdapter: StorageAdapter;

  /**
   * Optional authentication middleware to protect endpoints
   */
  authMiddleware?: (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

  /**
   * Base path for the routes (default: '/subscriptions')
   */
  basePath?: string;

  /**
   * Custom validation function for subscription data
   */
  validateSubscription?: (subscription: Partial<Subscription>) => Promise<void> | void;
}

/**
 * Validates subscription data from request body
 */
function validateSubscriptionData(data: any): void {
  if (!data.endpoint || typeof data.endpoint !== 'string') {
    throw new Error('Missing or invalid endpoint');
  }

  if (!data.keys || typeof data.keys !== 'object') {
    throw new Error('Missing or invalid keys');
  }

  if (!data.keys.p256dh || typeof data.keys.p256dh !== 'string') {
    throw new Error('Missing or invalid keys.p256dh');
  }

  if (!data.keys.auth || typeof data.keys.auth !== 'string') {
    throw new Error('Missing or invalid keys.auth');
  }
}

/**
 * Creates Express middleware for managing push notification subscriptions
 * 
 * @param options - Configuration options
 * @returns Express Router with subscription management endpoints
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { createExpressMiddleware } from '@allmightypush/push-express';
 * import { SQLiteStorageAdapter } from '@allmightypush/push-storage-sqlite';
 * 
 * const app = express();
 * const storage = new SQLiteStorageAdapter({ filename: './push.db' });
 * 
 * app.use(express.json());
 * app.use('/api/push', createExpressMiddleware({ storageAdapter: storage }));
 * ```
 */
export function createExpressMiddleware(options: ExpressMiddlewareOptions): Router {
  const { storageAdapter, authMiddleware, basePath = '', validateSubscription } = options;

  // Import express dynamically to avoid bundling it
  const express = require('express');
  const router: Router = express.Router();

  // Apply auth middleware if provided
  if (authMiddleware) {
    router.use(authMiddleware);
  }

  /**
   * POST /subscriptions - Create a new subscription
   * 
   * Request body:
   * {
   *   endpoint: string,
   *   keys: { p256dh: string, auth: string },
   *   userId?: string,
   *   metadata?: Record<string, any>
   * }
   * 
   * Response: 201 Created with subscription object
   */
  router.post(`${basePath}/subscriptions`, async (req: Request, res: Response) => {
    try {
      // Validate request body
      validateSubscriptionData(req.body);

      // Custom validation if provided
      if (validateSubscription) {
        await validateSubscription(req.body);
      }

      // Create subscription
      const subscription = await storageAdapter.createSubscription({
        endpoint: req.body.endpoint,
        keys: {
          p256dh: req.body.keys.p256dh,
          auth: req.body.keys.auth,
        },
        userId: req.body.userId,
        metadata: req.body.metadata,
      });

      res.status(201).json(subscription);
    } catch (error: any) {
      if (error.message.includes('Missing') || error.message.includes('invalid') || error.message.includes('must')) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create subscription' });
      }
    }
  });

  /**
   * GET /subscriptions/:id - Get a subscription by ID
   * 
   * Response: 200 OK with subscription object or 404 Not Found
   */
  router.get(`${basePath}/subscriptions/:id`, async (req: Request, res: Response): Promise<void> => {
    try {
      const subscription = await storageAdapter.getSubscriptionById(req.params.id);

      if (!subscription) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }

      res.json(subscription);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve subscription' });
    }
  });

  /**
   * GET /subscriptions - List subscriptions with optional filtering
   * 
   * Query parameters:
   * - userId: Filter by user ID
   * - status: Filter by status (active, expired, failed)
   * - limit: Maximum number of results (default: 100)
   * - offset: Pagination offset (default: 0)
   * 
   * Response: 200 OK with array of subscriptions
   */
  router.get(`${basePath}/subscriptions`, async (req: Request, res: Response) => {
    try {
      const filters: any = {};

      if (req.query.userId) {
        filters.userId = req.query.userId as string;
      }

      if (req.query.status) {
        filters.status = req.query.status as string;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const subscriptions = await storageAdapter.findSubscriptions(filters);

      // Apply pagination
      const paginatedResults = subscriptions.slice(offset, offset + limit);

      res.json({
        subscriptions: paginatedResults,
        total: subscriptions.length,
        limit,
        offset,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to list subscriptions' });
    }
  });

  /**
   * PATCH /subscriptions/:id - Update a subscription
   * 
   * Request body:
   * {
   *   status?: 'active' | 'expired' | 'failed',
   *   metadata?: Record<string, any>
   * }
   * 
   * Response: 200 OK with updated subscription or 404 Not Found
   */
  router.patch(`${basePath}/subscriptions/:id`, async (req: Request, res: Response): Promise<void> => {
    try {
      const subscription = await storageAdapter.getSubscriptionById(req.params.id);

      if (!subscription) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }

      const updates: Partial<Subscription> = {};

      if (req.body.status) {
        if (!['active', 'expired', 'failed'].includes(req.body.status)) {
          res.status(400).json({ error: 'Invalid status value' });
          return;
        }
        updates.status = req.body.status;
      }

      if (req.body.metadata !== undefined) {
        updates.metadata = req.body.metadata;
      }

      const updatedSubscription = await storageAdapter.updateSubscription(req.params.id, updates);
      res.json(updatedSubscription);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update subscription' });
    }
  });

  /**
   * DELETE /subscriptions/:id - Delete a subscription
   * 
   * Response: 204 No Content or 404 Not Found
   */
  router.delete(`${basePath}/subscriptions/:id`, async (req: Request, res: Response): Promise<void> => {
    try {
      const subscription = await storageAdapter.getSubscriptionById(req.params.id);

      if (!subscription) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }

      await storageAdapter.deleteSubscription(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to delete subscription' });
    }
  });

  return router;
}

export default createExpressMiddleware;
