import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages sub-paths and any static host.
// Two pages: the agency site and "İşlədiyimiz Üzlər" (paths are relative to the project root).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: 'index.html',
        uzler: 'uzler.html',
      },
    },
  },
});
