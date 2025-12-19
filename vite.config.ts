
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    base: './',
    server: {

      port: 3000,
      host: '0.0.0.0',
    },
    preview: {
      port: 4173,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      // 兼容旧字段，同时支持新的 VITE_API_KEY / VITE_API_BASE_URL
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY || env.GEMINI_API_KEY || ''),
      'process.env.API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || env.API_BASE_URL || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
