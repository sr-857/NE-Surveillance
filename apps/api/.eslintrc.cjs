module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { project: './tsconfig.json', sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  env: { node: true, es2022: true },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    'no-restricted-properties': [
      'error',
      {
        object: 'process',
        property: 'env',
        message: 'Do not access process.env directly — import { env } from "./config/env" instead.',
      },
    ],
  },
  overrides: [
    {
      files: ['src/config/env.ts'],
      rules: { 'no-restricted-properties': 'off' },
    },
    {
      files: ['tests/**/*.ts'],
      rules: { '@typescript-eslint/no-explicit-any': 'off' },
    },
  ],
  ignorePatterns: ['dist', 'node_modules'],
};
