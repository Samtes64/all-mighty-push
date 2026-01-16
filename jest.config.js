module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/**/*.spec.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  moduleNameMapper: {
    '^@allmightypush/push-core$': '<rootDir>/packages/push-core/src',
    '^@allmightypush/push-webpush$': '<rootDir>/packages/push-webpush/src',
    '^@allmightypush/push-storage-sqlite$': '<rootDir>/packages/push-storage-sqlite/src',
    '^@allmightypush/push-storage-postgres$': '<rootDir>/packages/push-storage-postgres/src',
    '^@allmightypush/push-storage-mongo$': '<rootDir>/packages/push-storage-mongo/src',
    '^@allmightypush/push-cli$': '<rootDir>/packages/push-cli/src',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
        },
      },
    ],
  },
};
