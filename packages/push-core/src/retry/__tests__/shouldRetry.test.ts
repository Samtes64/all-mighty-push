/**
 * Tests for shouldRetry function
 */

import { shouldRetry } from '../shouldRetry';
import type { ProviderResult } from '../../types/results';

describe('shouldRetry', () => {
  describe('Max retries enforcement', () => {
    it('should not retry when attempt equals maxRetries', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 500,
        shouldRetry: true,
      };

      expect(shouldRetry(result, 8, 8)).toBe(false);
    });

    it('should not retry when attempt exceeds maxRetries', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 500,
        shouldRetry: true,
      };

      expect(shouldRetry(result, 10, 8)).toBe(false);
    });

    it('should retry when attempt is below maxRetries', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 500,
        shouldRetry: true,
      };

      expect(shouldRetry(result, 5, 8)).toBe(true);
    });
  });

  describe('Provider shouldRetry flag', () => {
    it('should not retry when provider says shouldRetry is false', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 500,
        shouldRetry: false,
      };

      expect(shouldRetry(result, 0, 8)).toBe(false);
    });

    it('should respect provider shouldRetry flag for unknown status codes', () => {
      const result: ProviderResult = {
        success: false,
        shouldRetry: true,
      };

      expect(shouldRetry(result, 0, 8)).toBe(true);
    });
  });

  describe('Status code handling', () => {
    it('should retry on 500 Internal Server Error', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 500,
        shouldRetry: true,
      };

      expect(shouldRetry(result, 0, 8)).toBe(true);
    });

    it('should retry on 502 Bad Gateway', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 502,
        shouldRetry: true,
      };

      expect(shouldRetry(result, 0, 8)).toBe(true);
    });

    it('should retry on 503 Service Unavailable', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 503,
        shouldRetry: true,
      };

      expect(shouldRetry(result, 0, 8)).toBe(true);
    });

    it('should retry on 504 Gateway Timeout', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 504,
        shouldRetry: true,
      };

      expect(shouldRetry(result, 0, 8)).toBe(true);
    });

    it('should retry on 429 Too Many Requests', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 429,
        shouldRetry: true,
      };

      expect(shouldRetry(result, 0, 8)).toBe(true);
    });

    it('should not retry on 400 Bad Request', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 400,
        shouldRetry: false,
      };

      expect(shouldRetry(result, 0, 8)).toBe(false);
    });

    it('should not retry on 404 Not Found', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 404,
        shouldRetry: false,
      };

      expect(shouldRetry(result, 0, 8)).toBe(false);
    });

    it('should not retry on 410 Gone', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 410,
        shouldRetry: false,
      };

      expect(shouldRetry(result, 0, 8)).toBe(false);
    });
  });

  describe('Combined conditions', () => {
    it('should not retry when maxRetries reached even with 5xx', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 500,
        shouldRetry: true,
      };

      expect(shouldRetry(result, 8, 8)).toBe(false);
    });

    it('should not retry when provider says no even with 5xx', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 500,
        shouldRetry: false,
      };

      expect(shouldRetry(result, 0, 8)).toBe(false);
    });

    it('should retry when all conditions are met', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 503,
        shouldRetry: true,
      };

      expect(shouldRetry(result, 3, 8)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing status code', () => {
      const result: ProviderResult = {
        success: false,
        shouldRetry: true,
      };

      expect(shouldRetry(result, 0, 8)).toBe(true);
    });

    it('should handle attempt 0', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 500,
        shouldRetry: true,
      };

      expect(shouldRetry(result, 0, 8)).toBe(true);
    });

    it('should handle maxRetries of 0', () => {
      const result: ProviderResult = {
        success: false,
        statusCode: 500,
        shouldRetry: true,
      };

      expect(shouldRetry(result, 0, 0)).toBe(false);
    });
  });
});
