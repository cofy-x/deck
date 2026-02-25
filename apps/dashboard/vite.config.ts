/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tanstackRouter from '@tanstack/router-plugin/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check if DEBUG environment variable is set to 'true'
const isDebug = process.env['DEBUG'] === 'true';

export default defineConfig({
  plugins: [tanstackRouter(), react()],
  resolve: {
    // Recommendation: Rely on package manager symlinks and package.json exports by default.
    // Only use manual alias when you need HMR for source code debugging.
    alias: {
      // For Shadcn/UI
      '@': path.resolve(__dirname, './src'),

      // Conditionally map to source code if DEBUG=true is set
      ...(isDebug
        ? {
            '@cofy-x/react-core': path.resolve(
              __dirname,
              '../../packages/react-core/src/index.ts',
            ),
          }
        : {}),
    },
  },
  server: {
    port: 5173,
    host: true,

    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
  // Optimize dependency pre-bundling: Monorepo packages are symlinked and sometimes need explicit inclusion
  optimizeDeps: {
    include: ['@cofy-x/react-core', '@cofy-x/cog-types'],
  },
});
