import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

const tsconfigRootDir = new URL('.', import.meta.url).pathname;

const typeAwareConfigs = tseslint.configs.recommendedTypeChecked.map((config) => ({
	...config,
	languageOptions: {
		...config.languageOptions,
		parserOptions: {
			...config.languageOptions?.parserOptions,
			tsconfigRootDir,
			projectService: true,
		},
	},
}));

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
			// This recovered codebase predates type-aware ESLint. Keep the debt visible while
			// typecheck/tests/browser coverage remain the migration gates; new code should not
			// add to these warnings.
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unsafe-argument': 'warn',
			'@typescript-eslint/no-unsafe-assignment': 'warn',
			'@typescript-eslint/no-unsafe-call': 'warn',
			'@typescript-eslint/no-unsafe-member-access': 'warn',
			'@typescript-eslint/no-unsafe-return': 'warn',
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/no-unnecessary-type-assertion': 'warn',
			'@typescript-eslint/unbound-method': 'warn',
			'@typescript-eslint/only-throw-error': 'warn',
			'@typescript-eslint/prefer-promise-reject-errors': 'warn',
			'@typescript-eslint/require-await': 'warn',
			'@typescript-eslint/restrict-template-expressions': 'warn',
			'@typescript-eslint/no-empty-object-type': 'warn',
		},
	},
	eslintConfigPrettier,
];
