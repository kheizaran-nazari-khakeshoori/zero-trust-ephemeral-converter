export default [
  {
    ignores: ['node_modules/**', 'database.sqlite']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-constant-condition': 'error'
    }
  }
];