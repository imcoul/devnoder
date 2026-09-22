import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setupTests.ts'],
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 70,
        branches: 60,
        statements: 80,
      },
      include: ['src/services/**/*.ts'],
      exclude: ['src/services/**/*.test.ts', 'src/test/**/*'],
    },
  },
});
