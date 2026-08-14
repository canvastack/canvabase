import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'node:sqlite': fileURLToPath(new URL('./tests/dialects/node-sqlite-shim.ts', import.meta.url)),
      '@canvabase/dialects': fileURLToPath(new URL('./packages/dialects/src/index.ts', import.meta.url)),
      '@canvabase/contracts': fileURLToPath(new URL('./packages/contracts/src/index.ts', import.meta.url)),
      '@canvabase/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/dialects/src/**', 'packages/shared/src/**'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
});
