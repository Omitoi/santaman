import globals from 'globals';
import pluginJs from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
  { files: ['**/*.js'] },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.jest, io: 'readonly' },
      ecmaVersion: 2022,
    },
  },
  pluginJs.configs.recommended,
  prettierRecommended, // this includes the plugin and rules
  {
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'prettier/prettier': 'error',
    },
  },
];
