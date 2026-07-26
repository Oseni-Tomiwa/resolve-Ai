import { nestConfig } from '@resolveai/eslint-config';

export default [
  ...nestConfig,
  { files: ['**/*.spec.ts'], languageOptions: { globals: { describe: 'readonly', it: 'readonly', test: 'readonly', expect: 'readonly', jest: 'readonly', beforeEach: 'readonly', afterEach: 'readonly' } } },
];
