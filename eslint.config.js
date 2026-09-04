import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      // Only the two classic, stable hooks rules — v7's full `recommended`
      // config bundles new React-Compiler-oriented diagnostics (e.g.
      // "setState synchronously within an effect") that fire across most of
      // this pre-existing codebase's valid, working effects. Adopting those
      // is a real, separate migration effort, not a side effect of wiring up CI.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // This is a large, pre-existing codebase with no prior lint baseline —
      // turning ESLint on for the first time surfaced real, pre-existing
      // issues across ~15 files this change doesn't otherwise touch,
      // including regex escapes inside SecretDetector.ts, whose matching
      // behavior a blind autofix could silently change. Fixing that debt is
      // its own separate, reviewable pass, not a side effect of adding CI —
      // downgraded to warnings so `npm run lint` reports it (visible, not
      // hidden) without failing the build on code this change didn't write.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-useless-escape': 'warn',
      'no-useless-assignment': 'warn',
      'prefer-const': 'warn',
      'no-unused-expressions': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-empty': 'warn',
      'no-dupe-else-if': 'warn',
    },
  }
);
