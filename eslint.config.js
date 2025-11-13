// @ts-check
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import vuePlugin from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import prettierConfig from "eslint-config-prettier";
import {fileURLToPath} from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base rules from original config
const baseRules = {
	"block-scoped-var": "error",
	curly: ["error", "all"],
	"dot-notation": "error",
	eqeqeq: "error",
	"handle-callback-err": "error",
	"no-alert": "error",
	"no-catch-shadow": "error",
	"no-control-regex": "off",
	"no-console": "error",
	"no-duplicate-imports": "error",
	"no-else-return": "error",
	"no-implicit-globals": "error",
	"no-restricted-globals": ["error", "event", "fdescribe"],
	"no-template-curly-in-string": "error",
	"no-unsafe-negation": "error",
	"no-useless-computed-key": "error",
	"no-useless-constructor": "error",
	"no-useless-return": "error",
	"no-use-before-define": [
		"error",
		{
			functions: false,
		},
	],
	"no-var": "error",
	"object-shorthand": [
		"error",
		"methods",
		{
			avoidExplicitReturnArrows: true,
		},
	],
	"padding-line-between-statements": [
		"error",
		{
			blankLine: "always",
			prev: ["block", "block-like"],
			next: "*",
		},
		{
			blankLine: "always",
			prev: "*",
			next: ["block", "block-like"],
		},
	],
	"prefer-const": "error",
	"prefer-rest-params": "error",
	"prefer-spread": "error",
	"spaced-comment": ["error", "always"],
	strict: "off",
	yoda: "error",
};

// Vue-specific rules
const vueRules = {
	"import/no-default-export": 0,
	"import/unambiguous": 0, // vue SFC can miss script tags
	"@typescript-eslint/prefer-readonly": 0, // can be used in template
	"vue/component-tags-order": [
		"error",
		{
			order: ["template", "style", "script"],
		},
	],
	"vue/multi-word-component-names": "off",
	"vue/no-mutating-props": "off",
	"vue/no-v-html": "off",
	"vue/require-default-prop": "off",
	"vue/v-slot-style": ["error", "longform"],
};

// TypeScript-specific rules
const tsRules = {
	// note you must disable the base rule as it can report incorrect errors
	"no-shadow": "off",
	"@typescript-eslint/no-shadow": ["error"],
	"@typescript-eslint/no-redundant-type-constituents": "off",
};

// TODO: eventually remove these
const tsRulesTemp = {
	"@typescript-eslint/ban-ts-comment": "off",
	"@typescript-eslint/no-explicit-any": "off",
	"@typescript-eslint/no-non-null-assertion": "off",
	"@typescript-eslint/no-this-alias": "off",
	"@typescript-eslint/no-unnecessary-type-assertion": "off",
	"@typescript-eslint/no-unsafe-argument": "off",
	"@typescript-eslint/no-unsafe-assignment": "off",
	"@typescript-eslint/no-unsafe-call": "off",
	"@typescript-eslint/no-unsafe-member-access": "off",
	"@typescript-eslint/no-unused-vars": "off",
};

// TODO: remove these
const tsTestRulesTemp = {
	"@typescript-eslint/no-unsafe-return": "off",
	"@typescript-eslint/no-empty-function": "off",
	"@typescript-eslint/restrict-plus-operands": "off",
};

export default [
	// Global ignores
	{
		ignores: ["public/**", "coverage/**", "dist/**", "webpack.config.ts", "node_modules/**"],
	},

	// Base config for all JavaScript files
	{
		files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: {
				// Node.js globals
				console: "readonly",
				process: "readonly",
				Buffer: "readonly",
				__dirname: "readonly",
				__filename: "readonly",
				module: "readonly",
				require: "readonly",
				// Browser globals
				window: "readonly",
				document: "readonly",
				// Mocha globals
				describe: "readonly",
				it: "readonly",
				before: "readonly",
				after: "readonly",
				beforeEach: "readonly",
				afterEach: "readonly",
			},
		},
		...js.configs.recommended,
		rules: {
			...js.configs.recommended.rules,
			...baseRules,
		},
	},

	// TypeScript files
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: __dirname,
				ecmaVersion: "latest",
				sourceType: "module",
			},
			globals: {
				// Node.js globals
				console: "readonly",
				process: "readonly",
				Buffer: "readonly",
				__dirname: "readonly",
				__filename: "readonly",
				module: "readonly",
				require: "readonly",
				// Browser globals
				window: "readonly",
				document: "readonly",
				// Mocha globals
				describe: "readonly",
				it: "readonly",
				before: "readonly",
				after: "readonly",
				beforeEach: "readonly",
				afterEach: "readonly",
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
		},
		rules: {
			...js.configs.recommended.rules,
			...tseslint.configs.recommended.rules,
			...tseslint.configs["recommended-type-checked"].rules,
			...baseRules,
			...tsRules,
			...tsRulesTemp,
		},
	},

	// Vue files
	{
		files: ["**/*.vue"],
		languageOptions: {
			parser: vueParser,
			parserOptions: {
				parser: tsparser,
				projectService: true,
				tsconfigRootDir: __dirname,
				ecmaVersion: 2022,
				sourceType: "module",
				extraFileExtensions: [".vue"],
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: {
				// Node.js globals
				console: "readonly",
				process: "readonly",
				Buffer: "readonly",
				__dirname: "readonly",
				__filename: "readonly",
				module: "readonly",
				require: "readonly",
				// Browser globals
				window: "readonly",
				document: "readonly",
				// Mocha globals
				describe: "readonly",
				it: "readonly",
				before: "readonly",
				after: "readonly",
				beforeEach: "readonly",
				afterEach: "readonly",
			},
		},
		plugins: {
			vue: vuePlugin,
			"@typescript-eslint": tseslint,
		},
		rules: {
			...js.configs.recommended.rules,
			...vuePlugin.configs["vue3-recommended"].rules,
			...tseslint.configs.recommended.rules,
			...tseslint.configs["recommended-type-checked"].rules,
			...baseRules,
			...tsRules,
			...tsRulesTemp,
			...vueRules,
		},
	},

	// Test files - additional test-specific rules
	{
		files: ["test/**/*.ts", "tests/**/*.ts"],
		rules: {
			...tsTestRulesTemp,
		},
	},

	// Prettier config (must be last to override formatting rules)
	prettierConfig,
];
