import js from '@eslint/js';
import i18next from 'eslint-plugin-i18next';
import i18nextDefaults from 'eslint-plugin-i18next/lib/options/defaults.js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// eslint-plugin-i18next exempts every literal inside a SCREAMING_SNAKE variable and every default
// parameter value, and no option turns that off. Module-level label tables are exactly where copy
// hides, so both node types are routed through the handler the plugin uses for an ordinary
// lower-case variable, which checks its literals.
const pluginNoLiteralString = i18next.rules['no-literal-string'];
const i18nextPlugin = {
  ...i18next,
  rules: {
    ...i18next.rules,
    'no-literal-string': {
      ...pluginNoLiteralString,
      create(context) {
        const visitor = pluginNoLiteralString.create(context);
        const checkLikeLowerCaseVariable = () =>
          visitor.VariableDeclarator({ id: { name: 'checked' } });

        return {
          ...visitor,
          VariableDeclarator: checkLikeLowerCaseVariable,
          AssignmentPattern: checkLikeLowerCaseVariable,
        };
      },
    },
  },
};

// Options for i18next/no-literal-string. `all` mode checks every string literal and template, not
// only JSX text, because copy also lives in attributes, option arrays, message.* calls and .ts
// files. Structural strings are excluded by recurring class; a one-off technical string takes an
// inline suppression with a reason instead of a new entry here.
const i18nextLiteralStringOptions = {
  mode: 'all',
  'should-validate-template': true,
  'jsx-components': {
    exclude: ['Trans'],
  },
  // Props that never carry copy. An exclude-list rather than an include-list: a copy prop missing
  // from an include-list would go unchecked unnoticed, while a non-copy prop missing here shows up
  // as a lint error someone fixes.
  'jsx-attributes': {
    exclude: [
      ...i18nextDefaults['jsx-attributes'].exclude,
      '\\w*ClassName',
      'data-[\\w-]+',
      'accept',
      'align',
      'autoComplete',
      'color',
      'dataIndex',
      'direction',
      'format',
      'href',
      'htmlType',
      'i18nKey',
      'inputMode',
      'justify',
      'labelAlign',
      'lang',
      'layout',
      'mode',
      'name',
      'optionFilterProp',
      'path',
      'picker',
      'placement',
      'rel',
      'role',
      'rowKey',
      'shape',
      'size',
      'src',
      'status',
      'target',
      'theme',
      'trigger',
      'value',
      'variant',
    ],
  },
  words: {
    exclude: [
      // digits, punctuation and whitespace only, e.g. "0 2 * * *" or "********"
      '[\\s0-9!-/:-@[-`{-~]+',
      ...i18nextDefaults.words.exclude.filter((pattern) => pattern !== '[0-9!-/:-@[-`{-~]+'),
      // URLs and connection strings
      '(https?|wss?|s?ftp|s3|mongodb(\\+srv)?|postgres(ql)?|mysql|mariadb|jdbc:\\w+)://\\S*',
      // absolute and relative paths
      '\\.{0,2}/\\S*',
      // CSS values
      '#[0-9a-fA-F]{3,8}',
      '-?\\d+(\\.\\d+)?(px|rem|em|%|vh|vw|ms|s|fr)',
      // e-mail addresses used as examples
      '[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+',
      // BCP 47 language tags such as en-US
      '[a-z]{2}-[A-Z]{2}',
    ],
  },
  callees: {
    exclude: [
      ...i18nextDefaults.callees.exclude,
      'console\\.\\w+',
      'addHeader',
      'setMethod',
      'setCredentials',
      'document\\.\\w+',
      '(local|session)Storage\\.\\w+',
      'URLSearchParams',
      'searchParams\\.\\w+',
      // Map, Set and URLSearchParams lookups
      'get(All)?',
      'has',
      'dayjs(\\.\\w+)?',
      'format',
      'split',
      'join',
      'replace(All)?',
      'match(All)?',
      'test',
      'matchMedia',
      'querySelector(All)?',
      '(set|get|remove)Attribute',
      'classList\\.\\w+',
      // Error text never reaches the user: translateApiError shows only an ApiError's backend
      // message and a translated message otherwise.
      'Error',
      'TypeError',
    ],
  },
  'object-properties': {
    exclude: [
      ...i18nextDefaults['object-properties'].exclude,
      'align',
      'anchor',
      'path',
      // CSS properties set on DOM elements
      'border\\w*',
      'boxShadow',
      'cursor',
      'display',
      'fontWeight',
      'overflow\\w*',
      'position',
      'textAlign',
      'transition',
      'whiteSpace',
      'cache',
      'className',
      'color',
      'credentials',
      'dataIndex',
      'defaultSortOrder',
      'fixed',
      'format',
      'headers',
      'icon',
      'key',
      'method',
      'mode',
      'okType',
      'placement',
      'size',
      'type',
      'value',
      'width',
    ],
  },
};

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react: react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...react.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react/react-in-jsx-scope': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/api/**', 'src/shared/i18n/locales/**'],
    languageOptions: {
      // The contextual types from the TypeScript program let the rule skip a literal whose type is
      // a union of string literals, such as a TranslationKey or a prop typed 'small' | 'large'.
      parserOptions: {
        project: ['./tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { i18next: i18nextPlugin },
    rules: { 'i18next/no-literal-string': ['error', i18nextLiteralStringOptions] },
  },
);
