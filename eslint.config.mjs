import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig([
  { ignores: ['**/node_modules', '**/dist', '**/out'] },

  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],

  {
    settings: {
      react: { version: 'detect' }
    }
  },

  // Base TS/TSX rules
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-control-regex': 'off', // Intentional control char checks
      'no-useless-escape': 'warn'
    }
  },

  // Consolidated: preload, renderer, and tests don't need explicit return types
  {
    files: [
      '**/preload/**/*.ts',
      '**/renderer/**/*.{ts,tsx}',
      '**/tests/**/*.{ts,tsx}',
      '**/*.test.{ts,tsx}',
      '**/__mocks__/**/*.ts'
    ],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },

  // Preload: contextBridge needs any
  {
    files: ['**/preload/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },

  // Test files: relaxed but not completely open
  {
    files: ['**/tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/__mocks__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off'
      // Keep no-unused-vars with underscore pattern from base config
    }
  },

  eslintConfigPrettier
])
