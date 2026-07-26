import { nestConfig } from '@resolveai/eslint-config';
import globals from 'globals';

export default [
  ...nestConfig,
  { files: ['**/*.spec.ts'], languageOptions: { globals: { ...globals.jest } } },
];
