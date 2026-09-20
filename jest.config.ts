import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // La capa de caché de servidor (unstable_cache/revalidateTag) no tiene
    // store fuera del runtime de Next: el stub la vuelve passthrough en tests.
    '^next/cache$': '<rootDir>/tests/mocks/next-cache.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  transform: {
    '^.+\\.(ts|tsx|js|mjs)$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(dinero\\.js|nanoid)/)',
  ],
};

export default config;
