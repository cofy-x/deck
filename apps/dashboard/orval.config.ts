/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { defineConfig } from 'orval';

export default defineConfig({
  deck: {
    // 1. API endpoint - use local file or remote URL
    // Run: curl http://localhost:3001/api/doc-json -o openapi.json
    input: {
      target: './openapi-fixed.json',
    },
    output: {
      // 2. Output mode: tags-split (split by Controller) or single (single file)
      mode: 'tags-split',
      // 3. Output directory
      target: './src/lib/api/generated',
      schemas: './src/lib/api/model', // Put type definitions separately
      // 4. Client type: React Query
      client: 'react-query',
      // 5. Custom Axios instance (to handle global interceptors, like Token)
      override: {
        mutator: {
          path: './src/lib/api/axios-instance.ts',
          name: 'customInstance',
        },
      },
    },
    hooks: {
      afterAllFilesWrite: 'prettier --write', // Auto format after generation
    },
  },
});
