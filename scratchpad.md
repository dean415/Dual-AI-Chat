Step 1 — Types & Chat Extensions (Planner Mode)

Scope
- Define workflow persistence record types and extend `Chat` with fields for per‑chat workflow runs and current Canvas text. No runtime behavior changes.

Acceptance
- TypeScript compiles with new types available.
- No UI/state changes; only type additions.

Target File
- `dual-ai-chat/types.ts`

Proposed Types
```ts
// Status for workflow steps
export type WorkflowStepStatus = 'thinking' | 'done' | 'error';

// Structured per-step record (plain text only)
export interface WorkflowStepRecord {
  roleName: string;
  content: string;
  status: WorkflowStepStatus;
  durationMs?: number;
  error?: string;
  brand?: BrandKey;
  iconUrl?: string;
}

// One round contains the outputs of all steps (roles) in that round
export interface WorkflowRoundRecord {
  steps: WorkflowStepRecord[];
}

// A workflow run is a sequence of rounds, tied to a chat
export interface WorkflowRunRecord {
  id: string;           // runId
  startedAt: number;    // epoch ms
  name?: string;        // optional display name
  rounds: WorkflowRoundRecord[];
}
```

Chat Extensions
- Add two new fields to `Chat`:
  - `workflowRuns?: WorkflowRunRecord[]` (temporarily optional to avoid compile-time breakages before Step 2 migration)
  - `notepadCurrent?: string`

Proposed Chat shape (excerpt)
```ts
export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  workflowId?: string;
  messages: ChatMessage[];
  notepadSnapshots: NotepadSnapshot[];
  // New (Step 1; optional until Step 2 migration provides defaults)
  workflowRuns?: WorkflowRunRecord[];
  notepadCurrent?: string;
}
```

Notes & Rationale
- Optional for Step 1 only: Keeps TypeScript compiling without touching runtime creators/migrations yet. In Step 2 we will:
  - bump schema version and migrate existing chats with defaults `workflowRuns=[]`, `notepadCurrent=''`.
  - after migration lands, code can safely assume these fields exist (we may keep optional for compatibility or tighten later if desired).
- `BrandKey` already exists in `types.ts` and is referenced for branding metadata.

Integration Points (for later steps)
- `utils/storage.ts` (schema bump + migration defaults in Step 2).
- `utils/workflowStore.ts` or `store` layer helpers (Step 3) to expose `beginWorkflowRun`, `appendWorkflowRound`, `setNotepadCurrent`.
- Orchestrator hooks and Canvas listeners (Steps 5–7) will write into these structures.

Next (Step 2 Preview)
- Bump `SCHEMA_VERSION` and add migration to inject defaults for missing `workflowRuns`/`notepadCurrent` in all chats. Ensure first run doesn’t crash and old data remains intact.

Status
- Implemented in `dual-ai-chat/types.ts`:
  - Added `WorkflowStepStatus`, `WorkflowStepRecord`, `WorkflowRoundRecord`, `WorkflowRunRecord`.
  - Extended `Chat` with optional `workflowRuns?`, `notepadCurrent?`.
- Build check: `npm run build` succeeded without type errors.

Artifacts
- File updated: dual-ai-chat/types.ts

Notes
- Fields are optional pending Step 2 schema migration (will add defaults and can later tighten types if desired).

---

Step 2 — Storage Schema & Migration (Executor)

Changes
- Bumped `SCHEMA_VERSION` to 5 in `utils/storage.ts`.
- Added v4 → v5 migration:
  - For every chat in `dualAiChat.chats`, ensure `workflowRuns: []` and `notepadCurrent: ''` exist.
  - Left other data untouched; preserved `activeChatId`.
- Updated `createChat` defaults in `utils/chatStore.ts` to include `workflowRuns: []` and `notepadCurrent: ''` for new chats.

Acceptance
- First run after update does not crash; existing chats gain defaults.
- Old data remains intact; only new fields added.

Build
- `npm run build` succeeded.

Next
- Step 3: chatStore helpers — `beginWorkflowRun`, `appendWorkflowRound`, `setNotepadCurrent`.

---

Step 3 — chatStore Helpers (Executor)

Exports
- `beginWorkflowRun(runId, meta?)`: Creates `{ id, startedAt, name, rounds: [] }` in active chat (idempotent by runId).
- `appendWorkflowRound(runId, round)`: Appends a `WorkflowRoundRecord` to the specified run in active chat.
- `setNotepadCurrent(text)`: Updates active chat’s current Canvas text.

Behavior
- Updates in-memory cache and `localStorage` via `setChats()`; emits change events.
- Safeguards: No-ops if there is no active chat or the run is missing.

Files
- Updated: `dual-ai-chat/utils/chatStore.ts`

Build
- `npm run build` succeeded.

Next
- Step 4: Active‑Chat Guard utility (`captureActiveChatId`, `isActiveChat`) and integrate at orchestrator call sites.

---

Step 4 — Active‑Chat Guard (Executor)

Exports
- `captureActiveChatId(): RunChatId` — capture at run start.
- `isActiveChat(runChatId): boolean` — compare before each persist.
- `withActiveChatGuard(runChatId, action)` — convenience wrapper to skip writes safely.

Files
- Added: `dual-ai-chat/utils/activeChatGuard.ts`

Usage (to wire in Steps 5–7)
- At `runWorkflow` start: `const runChatId = captureActiveChatId()`.
- Before each `beginWorkflowRun/appendWorkflowRound/setNotepadCurrent`: check `isActiveChat(runChatId)` or wrap with `withActiveChatGuard`.

Build
- `npm run build` succeeded.

Next
- Step 5: Orchestrator Begin Hook — generate `runId` and call `beginWorkflowRun` guarded by `isActiveChat`.

---

Step 5 — Orchestrator Begin Hook (Executor)

Changes
- `hooks/useWorkflowOrchestrator.ts`:
  - Import `generateUniqueId`, `beginWorkflowRun`, `captureActiveChatId`, `isActiveChat`.
  - On `runWorkflow` start:
    - Capture `runChatId` via `captureActiveChatId()`.
    - Generate `runId = 'run-' + generateUniqueId()`.
    - If `isActiveChat(runChatId)`, call `beginWorkflowRun(runId, { name: workflow?.name, startedAt: runStartTs })`.

State
- Stored refs: `runIdRef`, `runChatIdRef` for later steps (round appends, canvas sync).

Build
- `npm run build` succeeded.

Next
- Step 6: After each round, construct `WorkflowRoundRecord` from per-round outputs and call `appendWorkflowRound` (guarded by `isActiveChat`).

---

Step 6 — Orchestrator Round Hook (Executor)

Changes
- `hooks/useWorkflowOrchestrator.ts`:
  - Track per-round `stepState` for each role: status, content/error, durationMs.
  - After `Promise.all(tasks)` per round, build `steps` from `stepState` and role order.
  - Guarded by `isActiveChat(runChatIdRef.current)` and using `runIdRef.current`, call `appendWorkflowRound(runId, { steps })`.

Notes
- `brand` field sourced from the provider’s `brandKey` when available.
- If a role has neither text nor explicit error (should be rare), it is marked as `error` with empty content.

Build
- `npm run build` succeeded.

Next
- Step 7: Canvas Sync — on Canvas changes, call `setNotepadCurrent` (debounced by storage save), and force-sync at run end.

---

Step 7 — Canvas Sync (Executor)

Changes
- `hooks/useNotepadLogic.ts`:
  - On every `_addHistoryEntry` (user edits, AI updates, undo/redo, clear), call `persistNotepadCurrent(newContent)` to store `Chat.notepadCurrent`.
- `hooks/useWorkflowOrchestrator.ts`:
  - After run completes and final content is computed, force a sync via `persistNotepadCurrent(finalContent)` if the active chat hasn’t changed.

Behavior
- Mid‑run user edits or AI notepad updates continuously update `notepadCurrent`.
- Run end ensures a final write even if debounced writes are pending.

Build
- `npm run build` succeeded.

Next
- Step 8: Restore workflow history from `workflowRuns` on chat switch.

---

Step 8 — Restore Workflow History (Executor)

Changes
- `App.tsx` chat-switch effect now restores persisted workflow history:
  - Reads `activeChat.workflowRuns` and maps each to `WorkflowRoundView[]` for `workflowRunHistory` state.
  - Clears live workflow bubble on switch.

Mapping
- For each step: `roleName`, `status`, `content`, `error`, `brand`, `iconUrl`, with `titleText = roleName`.

Build
- `npm run build` succeeded.

Next
- Step 9: Restore Canvas from `notepadCurrent` (fallback to last snapshot).

---

Step 9 — Restore Canvas (Executor)

Changes
- `App.tsx` chat-switch effect prefers `activeChat.notepadCurrent` when restoring the Notepad.
- Falls back to the last `notepadSnapshots` entry if empty; otherwise clears.

Build
- `npm run build` succeeded.

---

Step 10 — Cancel/Stop Paths (Executor)

Changes
- `App.tsx`:
  - On Stop in workflow mode, archive the current live `currentWorkflowEvent` into `workflowRunHistory` (UI history) before clearing the live bubble.
  - This does not clear or modify persisted `chat.workflowRuns`; previously persisted rounds remain intact.

Behavior
- Cancelling mid-run leaves previously persisted rounds visible when returning to the chat.
- In-session, the archived live bubble is kept in history for continuity.

Build
- `npm run build` succeeded.
New Plan — UI Polish

1) Canvas ghosting during Thinking
- Change: When `isLoading` is true, hide the Canvas content entirely and show only the Thinking animation.
- File: `dual-ai-chat/components/Notepad.tsx` — conditionally render preview HTML only when not loading.
- Result: No overlapping text; clean Thinking placeholder.

2) Chat list ordering & manual reorder
- Change: Stop auto-sorting by `updatedAt`; keep stored array order (new chats are prepended at create time).
- Add: Drag-and-drop to reorder chat items; persist via `setChats()`.
- File: `dual-ai-chat/components/ChatSidebar.tsx` — remove sort by `updatedAt`, add drag handlers to `<li>`.
- Result: Clicking a chat no longer moves it to top. Users can long-press/drag to reorder; default is creation order (new at top).

Build
- `npm run build` succeeded.
Theme Setting — Step 1 (UI only)

- Added Theme selector in Settings → General between Font Size and Enable Workflow Debug.
- Options: Default, Claude Style, Dark Mode.
- Props added to SettingsModal: `theme`, `onThemeChange`.
- App state: `theme` persisted in localStorage (`dualAiChatTheme`) and applied to `<html data-theme="...">` for future styling hooks.
- Files:
  - dual-ai-chat/components/SettingsModal.tsx
  - dual-ai-chat/App.tsx
- Build: `npm run build` succeeded.

Note: No visual theme changes yet; awaiting approval to implement Claude Style palette.

Claude Style — Step A (Beige Overrides)

- Requirement: Switch most pure white UI backgrounds to beige (#F5F5DC), excluding inputs/buttons.
- Implementation:
  - Add `[data-theme='claude']` CSS overrides in `index.html` style block.
  - Convert `.bg-white`, `body.bg-white`, `.markdown-preview` to `#F5F5DC` under Claude theme.
  - Keep form controls (`input, textarea, select, button`) white for clarity.
  - Minor scrollbar track tint for Notepad/Settings content in Claude mode.
- Persistence: Uses existing `data-theme` attribute set by App state.
- Build: `npm run build` succeeded.
