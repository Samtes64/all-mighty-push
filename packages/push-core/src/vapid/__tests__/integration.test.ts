/**
 * Integration tests for VAPID key management
 */

import { generateVapidKeys } from '../generateVapidKeys';
import { validateVapidKeys } from '../validateVapidKeys';

describe('VAPID Integration', () => {
  it('should generate keys that pass validation', () => {
    const keys = generateVapidKeys();

    // Should not throw
    expect(() => validateVapidKeys(keys)).not.toThrow();
  });

  it('should generate multiple valid key pairs', () => {
    for (let i = 0; i < 5; i++) {
      const keys = generateVapidKeys();

      expect(() => validateVapidKeys(keys)).not.toThrow();
      expect(keys.publicKey).toBeTruthy();
      expect(keys.privateKey).toBeTruthy();
    }
  });

  it('should generate keys that can be used for VAPID authentication', () => {
    const keys = generateVapidKeys();

    // Verify structure matches VapidKeys interface
    expect(keys).toMatchObject({
      publicKey: expect.any(String),
      privateKey: expect.any(String),
    });

    // Verify keys are in base64url format (required for VAPID)
    const base64urlPattern = /^[A-Za-z0-9_-]+$/;
    expect(keys.publicKey).toMatch(base64urlPattern);
    expect(keys.privateKey).toMatch(base64urlPattern);
  });
});
