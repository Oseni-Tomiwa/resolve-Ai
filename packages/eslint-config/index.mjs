import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const ignores = {
  ignores: [
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/.turbo/**',
    '**/.prisma/**',
    '**/prisma/generated/**',
  ],
};

const quality = {
  rules: {
    'no-console': 'warn',
    'no-constant-binary-expression': 'error',
    'no-duplicate-imports': 'error',
    'no-unused-vars': 'off',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
};

const typescript = {
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    globals: { ...globals.es2022 },
  },
  ...quality,
};

export const baseConfig = [ignores, eslint.configs.recommended, ...tseslint.configs.recommended, typescript];

export const nodeConfig = [
  ...baseConfig,
  { files: ['**/*.{ts,tsx}'], languageOptions: { globals: { ...globals.node } } },
];

export const nestConfig = [
  ...nodeConfig,
  { files: ['**/*.{ts,tsx}'], rules: { '@typescript-eslint/no-unsafe-declaration-merging': 'off' } },
];

export const nextConfig = [
  ...baseConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.es2022 } },
    settings: { react: { version: 'detect' } },
    rules: { 'no-var': 'error' },
  },
];
