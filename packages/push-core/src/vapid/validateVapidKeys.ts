/**
 * VAPID key validation functionality
 */

import { VapidKeys } from '../types/configuration';
import { ValidationError } from '../types/errors';

/**
 * Validates VAPID keys to ensure they are in the correct format.
 * 
 * This function checks that:
 * - Both publicKey and privateKey are present
 * - Both keys are non-empty strings
 * - Keys are in valid base64url format
 * 
 * @param keys - The VAPID keys to validate
 * @throws {ValidationError} If the keys are invalid with a descriptive error message
 * 
 * **Validates: Requirements 4.5**
 */
export function validateVapidKeys(keys: Partial<VapidKeys>): void {
  // Check for presence of publicKey
  if (!keys.publicKey) {
    throw new ValidationError('VAPID keys validation failed: publicKey is required', {
      providedKeys: Object.keys(keys),
    });
  }

  // Check for presence of privateKey
  if (!keys.privateKey) {
    throw new ValidationError('VAPID keys validation failed: privateKey is required', {
      providedKeys: Object.keys(keys),
    });
  }

  // Validate that keys are strings
  if (typeof keys.publicKey !== 'string') {
    throw new ValidationError('VAPID keys validation failed: publicKey must be a string', {
      publicKeyType: typeof keys.publicKey,
    });
  }

  if (typeof keys.privateKey !== 'string') {
    throw new ValidationError('VAPID keys validation failed: privateKey must be a string', {
      privateKeyType: typeof keys.privateKey,
    });
  }

  // Validate that keys are non-empty
  if (keys.publicKey.trim().length === 0) {
    throw new ValidationError('VAPID keys validation failed: publicKey cannot be empty');
  }

  if (keys.privateKey.trim().length === 0) {
    throw new ValidationError('VAPID keys validation failed: privateKey cannot be empty');
  }

  // Validate base64url format
  // Base64url uses: A-Z, a-z, 0-9, -, _ (no padding)
  const base64urlPattern = /^[A-Za-z0-9_-]+$/;

  if (!base64urlPattern.test(keys.publicKey)) {
    throw new ValidationError(
      'VAPID keys validation failed: publicKey is not in valid base64url format',
      {
        publicKey: keys.publicKey.substring(0, 20) + '...', // Only show first 20 chars for security
      }
    );
  }

  if (!base64urlPattern.test(keys.privateKey)) {
    throw new ValidationError(
      'VAPID keys validation failed: privateKey is not in valid base64url format',
      {
        privateKey: keys.privateKey.substring(0, 20) + '...', // Only show first 20 chars for security
      }
    );
  }
}
