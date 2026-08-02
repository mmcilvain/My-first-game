import { defineConfig } from 'vite';

export default defineConfig({
  build: {
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
