import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { slicerBridgePlugin } from './server/slicerPlugin.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), slicerBridgePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 3001,
    cors: true,
    watch: {
      ignored: ['**/temp_**/**', '**/*.gcode', '**/*.3mf', '**/result.json'],
    },
  },
});
