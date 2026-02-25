/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QuestionRequest, Todo } from '@opencode-ai/sdk/v2/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BrainStatus = 'idle' | 'thinking' | 'executing' | 'busy' | 'retry';

/** Normalized session error surfaced from `session.error` events. */
export interface SessionError {
  sessionID?: string;
  name: string;
  message: string;
}

interface ChatState {
  /** Currently active OpenCode session ID. */
  activeSessionId: string | null;
  /** Current chat input text. */
  inputText: string;
  /** AI agent brain status. */
  brainStatus: BrainStatus;
  /** Currently selected agent name (null = default). */
  selectedAgent: string | null;
  /** Pending questions from the AI that need user responses. */
  pendingQuestions: QuestionRequest[];
  /** Current session error (null when no error). */
  sessionError: SessionError | null;
  /** AI-managed todo items from `todo.updated` events. */
  todos: Todo[];
  /** Whether the agent selector should be programmatically opened. */
  agentSelectorOpen: boolean;
  /** Whether the model selector should be programmatically opened. */
  modelSelectorOpen: boolean;
  /** Whether the MCP dialog should be visible. */
  mcpDialogOpen: boolean;
  /** Whether the file picker dialog should be visible. */
  filePickerOpen: boolean;
  /** Incremented to request the chat input to focus. */
  focusRequestId: number;
}

interface ChatActions {
  setActiveSession: (sessionId: string | null) => void;
  setInputText: (text: string) => void;
  setBrainStatus: (status: BrainStatus) => void;
  setSelectedAgent: (agent: string | null) => void;
  /** Add a question to the pending queue. */
  addPendingQuestion: (question: QuestionRequest) => void;
  /** Remove a question by its request ID. */
  removePendingQuestion: (requestId: string) => void;
  /** Set or clear the session error. */
  setSessionError: (error: SessionError | null) => void;
  /** Replace the full todo list (from `todo.updated` events). */
  setTodos: (todos: Todo[]) => void;
  setAgentSelectorOpen: (open: boolean) => void;
  setModelSelectorOpen: (open: boolean) => void;
  setMcpDialogOpen: (open: boolean) => void;
  setFilePickerOpen: (open: boolean) => void;
  /** Request the chat input to focus (increment counter). */
  requestInputFocus: () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState: ChatState = {
  activeSessionId: null,
  inputText: '',
  brainStatus: 'idle',
  selectedAgent: null,
  pendingQuestions: [],
  sessionError: null,
  todos: [],
  agentSelectorOpen: false,
  modelSelectorOpen: false,
  mcpDialogOpen: false,
  filePickerOpen: false,
  focusRequestId: 0,
};

export const useChatStore = create<ChatState & ChatActions>()(
  persist(
    (set) => ({
      ...initialState,
      setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
      setInputText: (text) => set({ inputText: text }),
      setBrainStatus: (status) => set({ brainStatus: status }),
      setSelectedAgent: (agent) => set({ selectedAgent: agent }),
      addPendingQuestion: (question) =>
        set((state) => ({
          pendingQuestions: [...state.pendingQuestions, question],
        })),
      removePendingQuestion: (requestId) =>
        set((state) => ({
          pendingQuestions: state.pendingQuestions.filter(
            (q) => q.id !== requestId,
          ),
        })),
      setSessionError: (error) => set({ sessionError: error }),
      setTodos: (todos) => set({ todos }),
      setAgentSelectorOpen: (open) => set({ agentSelectorOpen: open }),
      setModelSelectorOpen: (open) => set({ modelSelectorOpen: open }),
      setMcpDialogOpen: (open) => set({ mcpDialogOpen: open }),
      setFilePickerOpen: (open) => set({ filePickerOpen: open }),
      requestInputFocus: () =>
        set((state) => ({ focusRequestId: state.focusRequestId + 1 })),
      reset: () => set(initialState),
    }),
    {
      name: 'deck-chat-session',
      // Only persist the active session and selected agent — everything
      // else is transient UI state that should start fresh.
      partialize: (state) => ({
        activeSessionId: state.activeSessionId,
        selectedAgent: state.selectedAgent,
      }),
    },
  ),
);
