/**
 * @allmightypush/push
 * Meta-package that re-exports core functionality for convenient usage
 */

// Re-export everything from push-core
export * from '@allmightypush/push-core';

// Re-export Web Push provider
export * from '@allmightypush/push-webpush';

// Re-export SQLite storage adapter (default)
export * from '@allmightypush/push-storage-sqlite';

// Version
export const version = '1.0.0';
