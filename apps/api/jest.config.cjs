/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: { '^.+\\.ts$': '<rootDir>/jest.transform.cjs' },
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
};
