export default {
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.e2e-spec\\.ts$',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { useESM: true, tsconfig: '<rootDir>/tsconfig.spec.json' },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFiles: ['<rootDir>/test/setup.ts'],
  testTimeout: 30000,
  maxWorkers: 1,
  coverageDirectory: 'coverage/e2e',
};
