import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // root apunta a web/ para que las rutas de los HTML sean relativas a ahí
  root: 'web',
  base: '/',
  build: {
    outDir: resolve(__dirname, 'public'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        admin: resolve(__dirname, 'web/admin/index.html'),
        print: resolve(__dirname, 'web/admin/print.html'),
        student: resolve(__dirname, 'web/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    // Proxy al servidor Express en dev para las rutas /api
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
