import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  transform: {
    '^.+\\.(ts|tsx|js|mjs)$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(dinero\\.js)/)',
  ],
};

export default config;
