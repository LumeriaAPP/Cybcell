import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages sub-paths and any static host.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
});
