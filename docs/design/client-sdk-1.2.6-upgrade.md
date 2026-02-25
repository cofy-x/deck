# Client SDK 1.2.6 Upgrade — Delta Streaming & Anti-Regression

> **Scope**: `apps/client`, `apps/pilot/bridge`, `apps/pilot/host`
> **SDK**: `@opencode-ai/sdk` 1.2.6
> **Date**: 2026-02

---

## Background

SDK v1.2.6 introduces **`message.part.delta`** events for incremental text
streaming. Previously, the server sent full `message.part.updated` snapshots
on every token. With the new contract:

| Event | Payload | Frequency |
| :--- | :--- | :--- |
| `message.part.delta` | `{ sessionID, messageID, partID, field, delta }` | High — every token chunk |
| `message.part.updated` | `{ part: Part }` (full snapshot) | Periodic — throttled snapshots |

Clients must merge delta text locally and handle the case where a snapshot
lags behind accumulated deltas.

---

## Problem: Streaming Text Flickering

After the initial SDK upgrade, two flickering problems appeared in the
client's `ChatPanel`:

1. **Thinking (reasoning) content flickered** during streaming because
   `message.part.updated` snapshots intermittently arrived with shorter text
   than what the client had already accumulated from deltas.

2. **Final text output flickered** at the end of streaming because the
   `session.status: idle` event triggered a full refetch, and the server's
   response was briefly a shorter snapshot than the locally-accumulated text.

---

## Solution Architecture

### 1. Anti-Regression Merging (`stream-delta-merge.ts`)

A new module (`apps/client/src/lib/stream-delta-merge.ts`) encapsulates all
streaming merge logic with a strict anti-regression guarantee:

| Function | Responsibility |
| :--- | :--- |
| `mergePartPreferNonRegressingText` | Part-level guard: when the incoming snapshot's text is a strict shorter prefix of the previous text, keep the longer version. |
| `mergeMessagesPreferNonRegressingText` | Message-array-level guard: applies per-part anti-regression across a full messages fetch result. |
| `mergeDeltaIntoPart` | Path-based delta merge: appends a string delta to a nested field inside a Part, creating intermediate objects as needed. |
| `mergeDeltaWithFallback` | Normalizes reasoning field aliases (`reasoning_content`, `reasoning_details` → `text`) and falls back to `text` appending for text/reasoning parts when the primary path fails. |
| `applyPendingDeltas` | Replays buffered deltas onto a part, returning applied result and any remaining un-mergeable deltas. |
| `compactPendingDeltas` | Compacts a pending-deltas buffer by concatenating consecutive same-field entries when the buffer exceeds `MAX_PENDING_PART_DELTAS`. |

### 2. Event Subscription Flow (`use-session.ts`)

The SSE event handler (`useEventSubscription`) processes three event types for
message content:

```
message.part.delta  →  updatePartDeltaInCache()
                       ├─ Inline merge via mergeDeltaWithFallback()
                       └─ Buffered in pendingPartDeltas if cache miss
message.part.updated → updatePartInCache()
                       ├─ Replay buffered deltas via replayPendingPartDeltas()
                       └─ Anti-regression merge via mergePartPreferNonRegressingText()
session.status:idle  →  pendingPartDeltas.clear()
session.idle         →  pendingPartDeltas.clear()
                        + invalidateMessages() → triggers refetch with anti-regression
```

The `useSessionMessages` hook always applies `mergeMessagesPreferNonRegressingText`
on every fetch result, comparing against the query cache's previous data. This
prevents the refetch triggered by idle events from regressing text.

### 3. Intentional Content Shortening (`session.compacted`)

When the server compacts a session (merging/trimming messages), the text
**should** become shorter. To avoid anti-regression blocking this:

```typescript
case 'session.compacted': {
  qc.removeQueries({ queryKey: SESSION_KEYS.messages(scope, sessionId) });
  invalidateMessages();
  invalidateSessions();
}
```

`removeQueries` clears the cache entirely so the subsequent fetch has no
previous data to compare against, allowing the compacted (shorter) text to
be accepted.

### 4. SSE Debug & Trace Modules

Extracted from inline code in `use-session.ts` into dedicated modules:

| Module | Purpose |
| :--- | :--- |
| `sse-event-summary.ts` | Centralizes SSE event digest extraction, compact/JSON formatting, and loggable-event filtering. |
| `sse-trace.ts` | Manages Tauri file trace and debug panel entry writing with module-scoped state for the trace log path. |

### 5. Pilot Bridge (`event-stream.ts`)

The bridge handles `message.part.delta` for Telegram live-editing:

- Filters on `field === 'text'` (only text deltas are relevant for Telegram).
- Constructs a synthetic `MessagePartStreamProps` via `createDeltaTextPartProps`
  to feed into the `TelegramStreamCoordinator` which accumulates text
  per-part and throttle-flushes edits.

---

## Files Changed

### New Files

| File | Lines | Description |
| :--- | :--- | :--- |
| `apps/client/src/lib/stream-delta-merge.ts` | ~222 | Delta merge and anti-regression logic |
| `apps/client/src/lib/stream-delta-merge.test.ts` | ~426 | 41 unit tests for merge functions |
| `apps/client/src/lib/sse-event-summary.ts` | ~152 | SSE event digest and formatting |
| `apps/client/src/lib/sse-event-summary.test.ts` | ~250 | 32 unit tests for summary functions |
| `apps/client/src/lib/sse-trace.ts` | ~118 | SSE trace file and debug panel logging |
| `apps/client/src-tauri/src/sse_trace.rs` | ~84 | Rust-side trace file I/O |

### Modified Files

| File | Key Changes |
| :--- | :--- |
| `apps/client/src/hooks/use-session.ts` | Replaced inline merge/trace logic with module imports; added `session.compacted` cache-clearing; always-on anti-regression in `useSessionMessages` |
| `apps/client/src/components/chat/message-item.tsx` | Adapted to streaming part rendering |
| `apps/client/src/components/chat/reasoning-block.tsx` | Adapted reasoning display for delta-accumulated text |
| `apps/pilot/bridge/src/bridge/event-stream.ts` | Added `message.part.delta` handler with `createDeltaTextPartProps` |
| `apps/pilot/bridge/src/bridge/telegram-stream-coordinator.ts` | Extended `onMessagePartUpdated` to accept delta-based props |
| `apps/pilot/bridge/src/types/events.ts` | Added `MessagePartDeltaProps`, `MessagePartStreamProps` types |

### Package Versions

| Package | File | Version |
| :--- | :--- | :--- |
| `apps/client/package.json` | `@opencode-ai/sdk` | `^1.2.6` |
| `apps/pilot/bridge/package.json` | `@opencode-ai/sdk` | `^1.2.6` |
| `apps/pilot/host/package.json` | `@opencode-ai/sdk` | `^1.2.6` |

---

## Design Principles Applied

| Principle | Application |
| :--- | :--- |
| **SRP** | Merge logic (`stream-delta-merge.ts`), event summarization (`sse-event-summary.ts`), and trace logging (`sse-trace.ts`) each have a single responsibility, extracted from the monolithic `use-session.ts`. |
| **OCP** | New event types (e.g., `session.compacted`) are added via new switch cases and `SSE_LOGGABLE_TYPES` entries without modifying existing merge or trace logic. |
| **DRY** | Delta trace formatting uses centralized `summarizeSseEventCompact`/`summarizeSseEventJson` instead of inline string building. Reasoning field normalization lives in one place (`mergeDeltaWithFallback`). |
| **ISP** | `MessagePartStreamProps` in the bridge defines a narrow interface (`{ part, delta? }`) that supports both full snapshots and deltas without leaking the full SDK event shape. |

---

## Test Coverage

| Test File | Tests | Coverage |
| :--- | :--- | :--- |
| `stream-delta-merge.test.ts` | 41 | All public functions: `isStreamTextPart`, `mergePartPreferNonRegressingText`, `mergeMessagesPreferNonRegressingText`, `mergeDeltaIntoPart`, `mergeDeltaWithFallback`, `applyPendingDeltas`, `compactPendingDeltas` |
| `sse-event-summary.test.ts` | 32 | `shouldLogSseEvent` (loggable/non-loggable), `summarizeSseEventJson` (all event types), `summarizeSseEventCompact` (all event types + edge cases) |
| `event-stream.test.ts` (bridge) | 5 | `message.part.delta` text streaming, event dispatch, permission handling |
