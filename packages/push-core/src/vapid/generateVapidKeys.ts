/**
 * VAPID key generation functionality
 */

import * as webpush from 'web-push';
import { VapidKeys } from '../types/configuration';
import { ValidationError } from '../types/errors';

/**
 * Generates a new VAPID key pair for Web Push authentication.
 * 
 * This function wraps the web-push library's generateVAPIDKeys method
 * and returns a properly typed object containing the public and private keys.
 * 
 * The generated keys are in base64url-encoded format and can be used
 * to authenticate push notifications according to the VAPID specification.
 * 
 * @returns A promise that resolves to an object containing publicKey and privateKey
 * @throws {ValidationError} If the generated keys are invalid or missing required fields
 * 
 * @example
 * ```typescript
 * const keys = await generateVapidKeys();
 * console.log('Public Key:', keys.publicKey);
 * console.log('Private Key:', keys.privateKey);
 * ```
 * 
 * **Validates: Requirements 4.1**
 */
export function generateVapidKeys(): VapidKeys {
  // Generate VAPID keys using the web-push library
  const keys = webpush.generateVAPIDKeys();

  // Validate that the generated keys have the required structure
  if (!keys || typeof keys !== 'object') {
    throw new ValidationError('Failed to generate VAPID keys: Invalid output from web-push library', {
      output: keys,
    });
  }

  if (!keys.publicKey || typeof keys.publicKey !== 'string') {
    throw new ValidationError('Failed to generate VAPID keys: Missing or invalid publicKey', {
      publicKey: keys.publicKey,
    });
  }

  if (!keys.privateKey || typeof keys.privateKey !== 'string') {
    throw new ValidationError('Failed to generate VAPID keys: Missing or invalid privateKey', {
      privateKey: keys.privateKey,
    });
  }

  // Validate that keys are non-empty strings
  if (keys.publicKey.trim().length === 0) {
    throw new ValidationError('Failed to generate VAPID keys: publicKey is empty');
  }

  if (keys.privateKey.trim().length === 0) {
    throw new ValidationError('Failed to generate VAPID keys: privateKey is empty');
  }

  // Return the validated keys in the expected format
  return {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
  };
}
