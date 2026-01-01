import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

const tsconfigRootDir = new URL('.', import.meta.url).pathname;

const typeAwareConfigs = tseslint.configs.recommendedTypeChecked.map(
  (config) => ({
    ...config,
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        tsconfigRootDir,
        projectService: true,
      },
    },
  })
);

export default [
  {
    ignores: ['node_modules/**', 'dist/**', '.nx/**', '.build/**'],
  },
  js.configs.recommended,
  ...typeAwareConfigs,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  eslintConfigPrettier,
];
