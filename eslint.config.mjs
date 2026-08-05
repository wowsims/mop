import { defineConfig } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import json from 'eslint-plugin-json';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

export default defineConfig([
	{
		ignores: ['ui/core/proto/**', 'ui/worker/highs.js', 'dist/**', 'binary_dist/**', 'node_modules/**'],
	},
	{
		files: ['**/*.{js,jsx,ts,tsx}'],
		extends: [
			importPlugin.flatConfigs.errors,
			importPlugin.flatConfigs.warnings,
			importPlugin.flatConfigs.typescript,
			tseslint.configs.recommended,
		],
		plugins: {
			'simple-import-sort': simpleImportSort,
		},
		languageOptions: {
			ecmaVersion: 2021,
			sourceType: 'module',
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
		},
		rules: {
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-use-before-define': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
				},
			],
			// Successor of the old no-empty-interface, which was kept off.
			'@typescript-eslint/no-empty-object-type': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
			'@typescript-eslint/no-this-alias': 'off',
			'@typescript-eslint/ban-ts-comment': 'off',
			'import/no-unresolved': 'off',
			'simple-import-sort/imports': 'warn',
			'import/named': 'off',
			'import/namespace': 'off',
			'arrow-parens': ['error', 'as-needed'],
		},
	},
	{
		files: ['**/*.json'],
		extends: [json.configs.recommended],
	},
]);
