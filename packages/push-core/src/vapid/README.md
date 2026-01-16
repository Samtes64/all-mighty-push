# VAPID Key Management

This module provides utilities for generating and validating VAPID (Voluntary Application Server Identification) keys used for Web Push authentication.

## Overview

VAPID is a protocol that allows push services to identify the application server sending push notifications. It uses public/private key pairs for authentication.

## Functions

### `generateVapidKeys()`

Generates a new VAPID key pair.

**Returns:** `VapidKeys` - An object containing `publicKey` and `privateKey` in base64url format.

**Example:**
```typescript
import { generateVapidKeys } from '@allmightypush/push-core';

const keys = generateVapidKeys();
console.log('Public Key:', keys.publicKey);
console.log('Private Key:', keys.privateKey);
```

**Requirements:** Validates Requirements 4.1

### `validateVapidKeys(keys)`

Validates that VAPID keys are in the correct format.

**Parameters:**
- `keys` - Partial VAPID keys object to validate

**Throws:** `ValidationError` if keys are invalid

**Example:**
```typescript
import { validateVapidKeys } from '@allmightypush/push-core';

try {
  validateVapidKeys({
    publicKey: 'your-public-key',
    privateKey: 'your-private-key'
  });
  console.log('Keys are valid!');
} catch (error) {
  console.error('Invalid keys:', error.message);
}
```

**Requirements:** Validates Requirements 4.5

## Key Format

VAPID keys are base64url-encoded strings:
- **Public Key**: Typically 87 characters
- **Private Key**: Typically 43 characters
- **Character Set**: `A-Z`, `a-z`, `0-9`, `-`, `_` (no padding)

## Security Considerations

- **Never commit private keys to version control**
- Store private keys securely (environment variables, secrets management)
- Generate new keys for each environment (development, staging, production)
- Public keys can be safely shared with clients

## Related

- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
