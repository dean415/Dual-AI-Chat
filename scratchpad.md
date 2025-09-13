Scope

In-scope: OpenAI messages-based orchestration; Role Library; Workflow Editor; round-parallel execution; history N; assistant(name) injection; MoaStepCard rendering; final notepad snapshot memory.
Out-of-scope: Gemini-specific history/injection; legacy Discussion/MoE behaviors; images; advanced branching/router.
Architecture Overview

Data: Add Role Library and Workflow Presets; global transcript only stores user and notepad snapshots.
Runtime: New orchestrator executes rounds sequentially; roles per round in parallel; builds OpenAI messages for each role with exact rules.
UI: New Role Library page and Workflow Editor (双栏); replace Team/MoE UI; render outputs with MoaStepCard.
Memory: After the whole workflow completes, append one assistant(notepad snapshot) message to transcript; used as future history.
Data Model

Role (RoleLibraryItem)
id: string
name: string
providerId: string
modelId: string
systemPrompt?: string
parameters?: { temperature?, top_p?, reasoning_effort?, verbosity? } // present only when enabled
WorkflowPreset
id: string
name: string
isActive: boolean
rounds: Array<{
roles: string[] // role names (you avoid duplicates)
perRole: Record<string, { historyN: 0 | 2 | 4 | 6 | 8; receiveFrom: string[] }>
}>
Transcript (global, across runs)
Array<{ role: 'user' | 'assistant_notepad'; content: string; at: number }>
assistant_notepad is the final notepad snapshot; no assistant(name) is persisted here.
Per-Run Output Index (ephemeral)
Map<roleName, { roundIndex: number; content: string }[]> // for “接收内容”选择最近一次
Storage & Migration

Add storage keys:
dualAiChat.roleLibrary
dualAiChat.workflowPresets
dualAiChat.activeWorkflowId
dualAiChat.transcript
Migration:
Hide Team/MoE UI; do not migrate old presets initially (keep code until cleanup step).
Initialize with empty RoleLibrary and one empty Workflow.
OpenAI Messages Assembly

For each role execution in a round:
Base sequence: [system?] → historyN → receiveFrom → currentUser
system (optional): from role.systemPrompt
historyN (only two sources; old→new)
user messages (past user texts)
assistant_notepad snapshot messages (as assistant without name)
take last N before current round; append in chronological order
receiveFrom (inject per UI order):
for each selected roleName in any previous round (1..i-1), find its latest output in “this run”; append { role: 'assistant', name: roleName, content }
currentUser: append { role: 'user', content: currentUserInput }
On success: persist this role’s output to per-run output index as the role’s latest output.
After all rounds complete: write one global transcript item:
{ role: 'assistant_notepad', content: finalNotepadContent, at: now }
Concurrency And Ordering

Round-level: rounds execute sequentially (i=1..n)
Role-level: roles in each round execute in parallel (Promise.all)
Notepad updates: apply as role outputs arrive; no snapshot used by history inside the same run.
History N for next runs only: only past transcript (users + notepad snapshots) is used; never the current run’s partial outputs.
UI Changes

Left toolbar: replace “团队管理” with “工作流”入口；保留“设置”(API Channels)与“清空”。
Role Library page:
List, Add/Edit/Delete role
Fields: Name, Provider, ModelId, SystemPrompt, toggled parameters
Remove user template entirely
Workflow Editor (双栏):
左栏: Rounds list (default 3), per round role selection (dropdown + free text, comma-separated, 1–4 items)
右栏: Current round roles (vertical); each row has:
历史下拉: Disabled/2/4/6/8 (default Disabled)
接收内容: Multi-select from all roles in previous rounds (1..i-1), default Disabled
顶栏: “+” add round; circle switch activates this workflow; at most one active
Chat rendering:
Use MoaStepCard to show each role’s output; group by round with a small “Round i” label.
Error Handling

Per-role failure: show error in card; other roles continue; next rounds still run.
接收内容: if no available output for a selected roleName, silently skip.
API key/provider errors: keep current error paths; do not add special Gemini logic.
Minimal Execution Flow

On user sends message:
Append user message to transcript? No — transcript only stores user and notepad snapshots. Yes, we should store user messages for history N. Therefore, append { role: 'user', content, at: now } immediately.
If active workflow exists, run orchestrator over this input.
Render round i results using MoaStepCard as they arrive.
At end, snapshot notepad to transcript as assistant_notepad (single message).
Step-by-Step Implementation Plan (each step: one function)

Add OpenAI messages call
Create generateOpenAiChat(messages, modelId, apiKey, baseUrl, parameters?) supporting assistant.name; keep existing string-mode function for legacy.
Add core types
Add RoleLibraryItem and WorkflowPreset types; add Transcript message type (user | assistant_notepad).
Add storage keys
Implement load/save for roleLibrary, workflowPresets, activeWorkflowId, transcript; initialize defaults.
Build orchestrator (logic only)
Create useWorkflowOrchestrator with runWorkflow(userInput): Promise<void>:
Reads active preset; executes rounds sequentially; roles per round via Promise.all; builds messages; collects outputs; updates notepad; writes final snapshot to transcript.
Wire orchestrator into send pipeline
In App.tsx: on user send, append user to transcript; if active workflow → run orchestrator; otherwise no-op or fallback (optional).
Render results with MoaStepCard
Add a simple “RoundGroup” component to render round’s role cards; append as results stream in chat area without changing bubble styles.
Role Library UI
Add Role Library modal/page; reuse existing RoleConfigEditor internals but hide User Template; add list + add/edit/delete.
Workflow Editor UI
Add modal/page with 双栏布局; implement role selection, per-role historyN and receiveFrom; add “+” and activation switch.
Replace toolbar entry
Replace Team button with Workflow button; hide Team modal entry; keep file code intact.
Remove Discussion/MoE runtime hooks
Stop invoking useChatLogic and useMoeLogic; keep files, but unused in UI to minimize risk.
Remove User Prompt templates usage
Strip userPromptTemplate from execution path; keep field removed in Role UI; ignore during calls.
Final notepad snapshot on completion
After orchestrator finishes all rounds, append a single { role: 'assistant_notepad', content, at } to transcript.
Message Assembly Pseudocode

history = takeLastN(transcript, N, where role in ['user','assistant_notepad'])
base = []
if systemPrompt: base.push({ role: 'system', content: systemPrompt })
base.push(...history.map(m => m.role === 'user'
? { role: 'user', content: m.content }
: { role: 'assistant', content: m.content }))
for name of receiveFrom (in UI order):
prev = latestOutputInThisRun(name) // any prior round
if prev: base.push({ role: 'assistant', name, content: prev })
base.push({ role: 'user', content: currentUserInput })
call OpenAI; save output for roleName; render card; apply notepad updates if any
Acceptance Criteria

Round-level concurrency: roles in the same round run concurrently; next round waits.
History N: exactly includes only (user + notepad snapshots), old→new, then current user.
接收内容: injects assistant(name) from latest prior-round outputs, in UI order, before current user.
UI: Role Library + Workflow Editor available; MoaStepCard shows outputs grouped by round; Team/MoE no longer accessible.
Memory: After completion, one assistant_notepad snapshot is appended; used as history for future runs.
Risks & Simplifications

Non-OpenAI roles: not optimized; they can be ignored or executed without history; minimal handling to avoid crashes.
Name safety: you use short English names; no extra slug needed.
Persistence: no migration from old Team/MoE; acceptable given your usage.