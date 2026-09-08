export default [
  {
    ignores: ['node_modules/**', 'database.sqlite', 'database.sqlite-journal']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-constant-condition': 'error',
      'no-control-regex': 'off'
    }
  }
];