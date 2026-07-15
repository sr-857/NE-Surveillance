import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['**/dist/**', '**/*.d.ts', 'src/db/prisma/**'],
      thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 },
    },
    testTimeout: 15000,
  },
});
