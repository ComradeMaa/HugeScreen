import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    // 开发时代理 API 到 Express 服务
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // DataV GeoJSON API 代理（去掉 Referer 绕过校验）
      '/geodata': {
        target: 'https://geo.datav.aliyun.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/geodata/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('Referer');
            proxyReq.removeHeader('Origin');
          });
        },
      },
      // OSM Overpass API 代理
      '/overpass': {
        target: 'https://overpass-api.de',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/overpass/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        viewer: resolve(__dirname, 'viewer.html'),
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-three': ['three'],
          'vendor-r3f': ['@react-three/fiber', '@react-three/drei'],
          'vendor-echarts': ['echarts'],
          'vendor-state': ['zustand', 'zundo', '@dnd-kit/core', '@dnd-kit/sortable'],
        },
      },
    },
  },
});
