import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// "no clever tricks" + AI-decodability: `any` defeats the type contracts.
			'@typescript-eslint/no-explicit-any': 'error',
			// Plain internal hrefs are clearer than resolve() wrappers for this app.
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: { parser: ts.parser }
		}
	},
	{
		ignores: [
			'.svelte-kit/',
			'build/',
			'dist/',
			'.wrangler/',
			'node_modules/',
			'src/lib/types/database.ts'
		]
	}
);
