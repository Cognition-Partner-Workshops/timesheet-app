const js = require('@eslint/js');
const globals = require('globals');
const tseslint = require('typescript-eslint');
const jest = require('eslint-plugin-jest');
const prettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: ['**/coverage/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'all' },
      ],
      eqeqeq: ['error', 'smart'],
      'no-console': 'off',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['**/__tests__/**/*.js'],
    plugins: { jest },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest },
    },
    rules: jest.configs['flat/recommended'].rules,
  },
);
