import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import { importX } from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import prettier from 'eslint-plugin-prettier';
import unusedImports from 'eslint-plugin-unused-imports';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{ ignores: ['dist', 'coverage', 'docs', 'node_modules'] },
	js.configs.recommended,
	tseslint.configs.recommended,
	importX.flatConfigs.recommended,
	importX.flatConfigs.typescript,
	prettierConfig,
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: { ...globals.node, ...globals.jest }
		},
		plugins: { prettier, 'unused-imports': unusedImports, jsdoc },
		settings: {
			'import-x/resolver-next': [createTypeScriptImportResolver({ project: './tsconfig.json' })]
		},
		rules: {
			'import-x/no-cycle': 'error',
			'import-x/no-named-as-default-member': 'off',
			eqeqeq: ['error', 'always', { null: 'ignore' }],
			'unused-imports/no-unused-imports': 'error',
			'func-style': ['error', 'declaration'],
			'prefer-arrow-callback': 'off',
			'no-restricted-syntax': ['error', { selector: 'ArrowFunctionExpression', message: 'Use function declarations/expressions instead of arrow functions.' }],
			'no-duplicate-imports': 'error',
			'max-len': ['error', { code: 175, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreComments: true }],
			'prettier/prettier': 'warn',
			'no-unused-expressions': 'off',
			'@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true }],
			'no-console': 'error',
			'no-var': 'error',
			'prefer-const': 'error',
			'no-useless-constructor': 'error',
			'jsdoc/require-jsdoc': ['error', { require: { FunctionDeclaration: true } }],
			'@typescript-eslint/no-shadow': 'error',
			'@typescript-eslint/no-empty-function': 'error',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'@typescript-eslint/naming-convention': [
				'error',
				{ selector: 'interface', format: ['PascalCase'] },
				{ selector: 'typeAlias', format: ['PascalCase'] },
				{ selector: 'typeParameter', format: ['PascalCase'] },
				{ selector: 'enumMember', format: ['PascalCase'] }
			]
		}
	},
	{
		files: ['src/**/*.spec.ts'],
		rules: {
			'jsdoc/require-jsdoc': 'off',
			'import-x/no-named-as-default': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-empty-function': 'off',
			// Type-level tests declare values that are only consumed through `typeof`.
			'@typescript-eslint/no-unused-vars': 'off'
		}
	}
);
