# Client Chat Retry Design (apps/client)

This document explains the retry design in `apps/client` for failed user turns,
especially attachment-related failures.

## Scope

- Chat retry behavior in the desktop client.
- Retry payload reconstruction from existing user messages.
- Attachment compatibility preprocessing before `session.prompt`.

Primary implementation files:

- `apps/client/src/components/chat/chat-panel.tsx`
- `apps/client/src/components/chat/retry-payload.ts`
- `apps/client/src/lib/inlined-attachment.ts`
- `apps/client/src/hooks/use-session.ts`

## Goals

- Retry from the existing failed user turn instead of creating a new user bubble.
- Let users switch model/provider first, then retry with current model selection.
- Keep retry flow deterministic and inspectable in logs.
- Minimize duplicate UI state and avoid hidden fallback behavior.

## Non-Goals

- No backend API/schema changes.
- No automatic cross-model retry loop in the client.
- No broad retry behavior for all error types by default.

## Key Decisions

### 1) Retry from the user message, not from a global banner

Retry action is attached to retryable user messages. This keeps intent local to
the failed turn and avoids ambiguity when multiple errors exist in the session.

### 2) Reuse the same user message ID with explicit part reset

The client retries with:

1. `session.revert(sessionID, messageID)`
2. `part.delete(sessionID, messageID, partID)` for existing user parts
3. `session.prompt(sessionID, messageID, parts, model, agent, directory)`

Reason:

- Preserves conversation continuity.
- Avoids creating duplicated user turns for the same intent.
- Matches expected "retry current message" UX.
- Prevents `messageID`-scoped part accumulation across retries.

Implementation note:

- `part.delete` results must be validated via SDK `unwrap` (not promise status
  only), because request results can resolve with an error payload.

### 3) Build retry payload from normalized user parts

`retry-payload.ts` reconstructs:

- prompt text (visible text parts only)
- file attachments (`FilePartInput[]`)
- original agent

It also normalizes duplicate parts from historical retries to keep reconstruction
stable.

### 4) Preprocess textual file attachments before prompt

In `use-session.ts`, textual files are converted into text parts using a stable
inline format (`inlined-attachment.ts`). Binary/non-text files remain file parts.

Reason:

- Improves compatibility for models/providers that reject specific file media
  types (for example `text/markdown` file parts).
- Keeps original attachment semantics recoverable for retry/view rendering.

### 5) Keep error presentation non-duplicated

If a matching assistant error message is already present in the timeline, the
top session error banner is suppressed.

Reason:

- Avoid duplicate error surfaces for the same failure.

### 6) Invalidate both message and session list queries after prompt success

`useSendPrompt.onSuccess` invalidates:

- `SESSION_KEYS.messages(sessionId)`
- `SESSION_KEYS.list()`

Reason:

- Message history must refresh.
- Session list metadata (title/updated time/sorting) may change after prompt.

## Operational Notes for Future Agents

- Keep retry behavior explicit and user-triggered.
- Prefer SDK-defined types (`SessionPromptResponse`, `FilePartInput`, etc.).
- Do not add hidden auto-retry branches that can fork conversation history.
- If retry internals change, preserve these invariants:
  - no duplicate user bubbles for one retry action
  - payload is reconstructed from the original user message
  - retry uses current model selection and original agent

## Known Tradeoff

Retrying with the same `messageID` depends on backend semantics for message part
replacement/append behavior. Client-side normalization and logging are kept to
make this behavior observable and debuggable.
