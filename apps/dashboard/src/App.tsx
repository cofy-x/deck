/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { CORE_VERSION } from '@cofy-x/deck-core-ts';

export function App() {
  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <h1 style={{ marginBottom: '20px' }}>Deck Dashboard</h1>
      <p>Version: {CORE_VERSION}</p>
    </div>
  );
}
