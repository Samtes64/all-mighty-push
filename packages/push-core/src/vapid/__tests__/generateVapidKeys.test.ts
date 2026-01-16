/**
 * Tests for generateVapidKeys function
 */

import { generateVapidKeys } from '../generateVapidKeys';

describe('generateVapidKeys', () => {
  describe('Basic functionality', () => {
    it('should generate VAPID keys with publicKey and privateKey', () => {
      const keys = generateVapidKeys();

      expect(keys).toHaveProperty('publicKey');
      expect(keys).toHaveProperty('privateKey');
    });

    it('should return non-empty string keys', () => {
      const keys = generateVapidKeys();

      expect(typeof keys.publicKey).toBe('string');
      expect(typeof keys.privateKey).toBe('string');
      expect(keys.publicKey.length).toBeGreaterThan(0);
      expect(keys.privateKey.length).toBeGreaterThan(0);
    });

    it('should generate different keys on each call', () => {
      const keys1 = generateVapidKeys();
      const keys2 = generateVapidKeys();

      expect(keys1.publicKey).not.toBe(keys2.publicKey);
      expect(keys1.privateKey).not.toBe(keys2.privateKey);
    });

    it('should generate keys in base64url format', () => {
      const keys = generateVapidKeys();

      // Base64url uses: A-Z, a-z, 0-9, -, _ (no padding)
      const base64urlPattern = /^[A-Za-z0-9_-]+$/;

      expect(keys.publicKey).toMatch(base64urlPattern);
      expect(keys.privateKey).toMatch(base64urlPattern);
    });
  });

  describe('Output validation', () => {
    it('should return keys with expected structure', () => {
      const keys = generateVapidKeys();

      // Should have exactly publicKey and privateKey (no subject by default)
      expect(Object.keys(keys).sort()).toEqual(['privateKey', 'publicKey']);
    });

    it('should generate keys of reasonable length', () => {
      const keys = generateVapidKeys();

      // VAPID keys are typically 87 characters for public key
      // and 43 characters for private key (base64url encoded)
      expect(keys.publicKey.length).toBeGreaterThan(80);
      expect(keys.privateKey.length).toBeGreaterThan(40);
    });
  });

  describe('Edge cases', () => {
    it('should not include subject field by default', () => {
      const keys = generateVapidKeys();

      expect(keys.subject).toBeUndefined();
    });

    it('should generate valid keys consistently', () => {
      // Generate multiple keys to ensure consistency
      for (let i = 0; i < 10; i++) {
        const keys = generateVapidKeys();

        expect(keys.publicKey).toBeTruthy();
        expect(keys.privateKey).toBeTruthy();
        expect(typeof keys.publicKey).toBe('string');
        expect(typeof keys.privateKey).toBe('string');
      }
    });
  });
});
