/**
 * Unit tests for Web Push provider
 */

import { WebPushProvider } from '../web-push-provider';
import webPush from 'web-push';
import type { Subscription, NotificationPayload, SendOptions } from '@allmightypush/push-core';

// Mock the web-push library
jest.mock('web-push');

describe('WebPushProvider', () => {
  const mockConfig = {
    vapidPublicKey: 'BNXnC8Hs8qJqZ9Ks8qJqZ9Ks8qJqZ9Ks8qJqZ9Ks8qJqZ9Ks8qJqZ9Ks8qJqZ9Ks8qJqZ9Ks8qJqZ9K',
    vapidPrivateKey: 'test-private-key',
    vapidSubject: 'mailto:test@example.com',
  };

  const mockSubscription: Subscription = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
    keys: {
      p256dh: 'test-p256dh-key',
      auth: 'test-auth-key',
    },
    userId: 'user-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    failedCount: 0,
    status: 'active',
  };

  const mockPayload: NotificationPayload = {
    title: 'Test Notification',
    body: 'This is a test notification',
    icon: 'https://example.com/icon.png',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should configure web-push with VAPID details', () => {
      new WebPushProvider(mockConfig);

      expect(webPush.setVapidDetails).toHaveBeenCalledWith(
        mockConfig.vapidSubject,
        mockConfig.vapidPublicKey,
        mockConfig.vapidPrivateKey
      );
    });
  });

  describe('getName', () => {
    it('should return "web-push"', () => {
      const provider = new WebPushProvider(mockConfig);
      expect(provider.getName()).toBe('web-push');
    });
  });

  describe('send', () => {
    let provider: WebPushProvider;

    beforeEach(() => {
      provider = new WebPushProvider(mockConfig);
    });

    it('should send notification successfully with 201 status', async () => {
      const mockResponse = { statusCode: 201 };
      (webPush.sendNotification as jest.Mock).mockResolvedValue(mockResponse);

      const result = await provider.send(mockSubscription, mockPayload, {});

      expect(result).toEqual({
        success: true,
        statusCode: 201,
        shouldRetry: false,
      });

      expect(webPush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: mockSubscription.endpoint,
          keys: {
            p256dh: mockSubscription.keys.p256dh,
            auth: mockSubscription.keys.auth,
          },
        },
        JSON.stringify(mockPayload),
        {}
      );
    });

    it('should pass TTL option to web-push', async () => {
      const mockResponse = { statusCode: 201 };
      (webPush.sendNotification as jest.Mock).mockResolvedValue(mockResponse);

      const options: SendOptions = { ttl: 3600 };
      await provider.send(mockSubscription, mockPayload, options);

      expect(webPush.sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        { TTL: 3600 }
      );
    });

    it('should pass urgency option to web-push', async () => {
      const mockResponse = { statusCode: 201 };
      (webPush.sendNotification as jest.Mock).mockResolvedValue(mockResponse);

      const options: SendOptions = { urgency: 'high' };
      await provider.send(mockSubscription, mockPayload, options);

      expect(webPush.sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        { urgency: 'high' }
      );
    });

    it('should pass topic option to web-push', async () => {
      const mockResponse = { statusCode: 201 };
      (webPush.sendNotification as jest.Mock).mockResolvedValue(mockResponse);

      const options: SendOptions = { topic: 'news-updates' };
      await provider.send(mockSubscription, mockPayload, options);

      expect(webPush.sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        { topic: 'news-updates' }
      );
    });

    it('should pass all options to web-push', async () => {
      const mockResponse = { statusCode: 201 };
      (webPush.sendNotification as jest.Mock).mockResolvedValue(mockResponse);

      const options: SendOptions = {
        ttl: 3600,
        urgency: 'high',
        topic: 'news-updates',
      };
      await provider.send(mockSubscription, mockPayload, options);

      expect(webPush.sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        {
          TTL: 3600,
          urgency: 'high',
          topic: 'news-updates',
        }
      );
    });

    it('should handle 410 Gone (subscription expired) without retry', async () => {
      const error = {
        statusCode: 410,
        message: 'Gone',
      };
      (webPush.sendNotification as jest.Mock).mockRejectedValue(error);

      const result = await provider.send(mockSubscription, mockPayload, {});

      expect(result).toEqual({
        success: false,
        statusCode: 410,
        error: expect.any(Error),
        shouldRetry: false,
      });
      expect(result.error?.message).toBe('Subscription expired (410 Gone)');
    });

    it('should handle 429 Too Many Requests with retry', async () => {
      const error = {
        statusCode: 429,
        message: 'Too Many Requests',
      };
      (webPush.sendNotification as jest.Mock).mockRejectedValue(error);

      const result = await provider.send(mockSubscription, mockPayload, {});

      expect(result).toEqual({
        success: false,
        statusCode: 429,
        error: expect.any(Error),
        shouldRetry: true,
        retryAfter: undefined,
      });
      expect(result.error?.message).toBe('Rate limited (429 Too Many Requests)');
    });

    it('should extract Retry-After header from 429 response', async () => {
      const error = {
        statusCode: 429,
        message: 'Too Many Requests',
        headers: {
          'retry-after': '120',
        },
      };
      (webPush.sendNotification as jest.Mock).mockRejectedValue(error);

      const result = await provider.send(mockSubscription, mockPayload, {});

      expect(result).toEqual({
        success: false,
        statusCode: 429,
        error: expect.any(Error),
        shouldRetry: true,
        retryAfter: 120,
      });
    });

    it('should extract numeric Retry-After header', async () => {
      const error = {
        statusCode: 429,
        message: 'Too Many Requests',
        headers: {
          'retry-after': 60,
        },
      };
      (webPush.sendNotification as jest.Mock).mockRejectedValue(error);

      const result = await provider.send(mockSubscription, mockPayload, {});

      expect(result.retryAfter).toBe(60);
    });

    it('should handle 500 Server Error with retry', async () => {
      const error = {
        statusCode: 500,
        message: 'Internal Server Error',
      };
      (webPush.sendNotification as jest.Mock).mockRejectedValue(error);

      const result = await provider.send(mockSubscription, mockPayload, {});

      expect(result).toEqual({
        success: false,
        statusCode: 500,
        error: expect.any(Error),
        shouldRetry: true,
        retryAfter: undefined,
      });
      expect(result.error?.message).toContain('Server error (500)');
    });

    it('should handle 502 Bad Gateway with retry', async () => {
      const error = {
        statusCode: 502,
        message: 'Bad Gateway',
      };
      (webPush.sendNotification as jest.Mock).mockRejectedValue(error);

      const result = await provider.send(mockSubscription, mockPayload, {});

      expect(result).toEqual({
        success: false,
        statusCode: 502,
        error: expect.any(Error),
        shouldRetry: true,
        retryAfter: undefined,
      });
    });

    it('should handle 503 Service Unavailable with retry', async () => {
      const error = {
        statusCode: 503,
        message: 'Service Unavailable',
      };
      (webPush.sendNotification as jest.Mock).mockRejectedValue(error);

      const result = await provider.send(mockSubscription, mockPayload, {});

      expect(result.shouldRetry).toBe(true);
    });

    it('should handle 400 Bad Request without retry', async () => {
      const error = {
        statusCode: 400,
        message: 'Bad Request',
      };
      (webPush.sendNotification as jest.Mock).mockRejectedValue(error);

      const result = await provider.send(mockSubscription, mockPayload, {});

      expect(result).toEqual({
        success: false,
        statusCode: 400,
        error: expect.any(Error),
        shouldRetry: false,
      });
      expect(result.error?.message).toContain('Client error (400)');
    });

    it('should handle 401 Unauthorized without retry', async () => {
      const error = {
        statusCode: 401,
        message: 'Unauthorized',
      };
      (webPush.sendNotification as jest.Mock).mockRejectedValue(error);

      const result = await provider.send(mockSubscription, mockPayload, {});

      expect(result.shouldRetry).toBe(false);
    });

    it('should handle 404 Not Found without retry', async () => {
      const error = {
        statusCode: 404,
        message: 'Not Found',
      };
      (webPush.sendNotification as jest.Mock).mockRejectedValue(error);

      const result = await provider.send(mockSubscription, mockPayload, {});

      expect(result.shouldRetry).toBe(false);
    });

    it('should handle network errors with retry', async () => {
      const error = new Error('Network error: ECONNREFUSED');
      (webPush.sendNotification as jest.Mock).mockRejectedValue(error);

      const result = await provider.send(mockSubscription, mockPayload, {});

      expect(result).toEqual({
        success: false,
        statusCode: undefined,
        error: expect.any(Error),
        shouldRetry: true,
      });
      expect(result.error?.message).toBe('Network error: ECONNREFUSED');
    });

    it('should handle errors with status property instead of statusCode', async () => {
      const error = {
        status: 500,
        message: 'Internal Server Error',
      };
      (webPush.sendNotification as jest.Mock).mockRejectedValue(error);

      const result = await provider.send(mockSubscription, mockPayload, {});

      expect(result.statusCode).toBe(500);
      expect(result.shouldRetry).toBe(true);
    });

    it('should handle unknown errors with retry', async () => {
      const error = 'Unknown error string';
      (webPush.sendNotification as jest.Mock).mockRejectedValue(error);

      const result = await provider.send(mockSubscription, mockPayload, {});

      expect(result).toEqual({
        success: false,
        statusCode: undefined,
        error: expect.any(Error),
        shouldRetry: true,
      });
      expect(result.error?.message).toBe('Unknown error string');
    });

    it('should serialize complex payload correctly', async () => {
      const mockResponse = { statusCode: 201 };
      (webPush.sendNotification as jest.Mock).mockResolvedValue(mockResponse);

      const complexPayload: NotificationPayload = {
        title: 'Complex Notification',
        body: 'With many fields',
        icon: 'https://example.com/icon.png',
        badge: 'https://example.com/badge.png',
        data: {
          url: 'https://example.com/article/123',
          timestamp: 1234567890,
        },
        actions: [
          { action: 'view', title: 'View' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
        tag: 'news-update',
        requireInteraction: true,
      };

      await provider.send(mockSubscription, complexPayload, {});

      expect(webPush.sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        JSON.stringify(complexPayload),
        expect.any(Object)
      );
    });
  });
});
