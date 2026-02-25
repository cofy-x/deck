#!/usr/bin/env tsx

/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Demonstrate session management for interactive commands
 * Usage: pnpm tsx scripts/session-demo.ts
 */
import {
  create_session,
  session_execute,
  list_sessions,
  delete_session,
} from '../src/index.js';

async function main() {
  const sessionId = `demo-${Date.now()}`;

  console.log('=== Session Management Demo ===\n');

  try {
    // Create a new session
    console.log(`🔧 Creating session: ${sessionId}`);
    await create_session(sessionId);
    console.log('✓ Session created');
    console.log();

    // Execute commands in the session
    console.log('📝 Executing commands in session...');

    console.log('Command 1: echo "Hello from session"');
    const result1 = await session_execute(
      sessionId,
      'echo "Hello from session"',
    );
    console.log('Result:', JSON.stringify(result1, null, 2));
    console.log();

    console.log('Command 2: pwd');
    const result2 = await session_execute(sessionId, 'pwd');
    console.log('Result:', JSON.stringify(result2, null, 2));
    console.log();

    console.log('Command 3: ls -la');
    const result3 = await session_execute(sessionId, 'ls -la');
    console.log('Result:', JSON.stringify(result3, null, 2));
    console.log();

    // List all sessions
    console.log('📋 Listing all sessions:');
    const sessions = await list_sessions();
    console.log(JSON.stringify(sessions, null, 2));
    console.log();

    // Delete the session
    console.log(`🗑️  Deleting session: ${sessionId}`);
    await delete_session(sessionId);
    console.log('✓ Session deleted');
  } catch (error) {
    console.error('Error:', (error as Error).message);
    // Cleanup on error
    try {
      await delete_session(sessionId);
    } catch {
      // Ignore cleanup errors
    }
    process.exit(1);
  }
}

main();
