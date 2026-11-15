import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    optimizeDeps: {
      entries: ['index.html'],
    },
    server: {
      // HMR and standalone WS server are disabled in AI Studio to prevent WebSocket/port conflicts
      hmr: false,
      ws: false as const,
      watch: null,
    },
  };
});
