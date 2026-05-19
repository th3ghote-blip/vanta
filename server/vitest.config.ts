import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 10_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    // Source files are ESM-style with `.js` extensions on relative imports
    // (e.g. `from '../lib/supabase.js'`). Vite-node honours those because
    // the source files are .ts — no extra alias needed. This config is
    // kept minimal on purpose.
  },
});
