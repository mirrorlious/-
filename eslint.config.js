import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public-resources/**']
  },
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      'jsx-a11y': jsxA11y
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // The rule's component-pattern matcher still assumes minimatch's legacy CommonJS API.
      // Native labels are covered by axe and the label/control browser regressions instead.
      'jsx-a11y/label-has-associated-control': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': ['error', { roles: ['region'], handlers: ['onKeyDown'] }],
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['tabpanel', 'region'] }],
      'jsx-a11y/no-autofocus': 'off',
      'jsx-a11y/media-has-caption': 'off'
    }
  }
];
