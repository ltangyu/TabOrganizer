import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'preview',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: Number(process.env.PORT) || 5180,
    strictPort: false,
    host: '127.0.0.1',
  },
  build: {
    outDir: resolve(__dirname, 'dist-preview'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'preview/index.html'),
        popup: resolve(__dirname, 'preview/popup-preview.html'),
        manager: resolve(__dirname, 'preview/manager-preview.html'),
      },
    },
  },
});
