import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base works on GitHub Pages sub-paths and on itch.io.
  base: './',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
