import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Three.js is an intentional shared vendor chunk; keep Vite's warning aligned with it.
    chunkSizeWarningLimit: 520,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three-vendor';
          if (id.includes('/src/world/')) return 'world';
          if (id.includes('/src/game/')) return 'game';
          return undefined;
        },
      },
    },
  },
});
