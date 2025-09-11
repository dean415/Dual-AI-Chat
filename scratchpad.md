## Background and Motivation

Dual‑AI Chat targets two execution modes that share UX and state primitives while diverging in orchestration:
- Discussion Mode: sequential, dual roles (Cognito → Muse) with fixed/AI‑driven rounds. Final output must be written to the right‑side Notebook via `<np-*>` commands.
- MoE Mode: three‑stage parallel pipeline (R1A/R1B → R2C/R2D → Summarizer). Cards on the left render progressively; the Summarizer only updates the Notebook.

Current gaps (from AGENT.md Current Project Status):
- User messages aren’t inserted in MoE flow before processing; UI disabled states are inconsistent (`isLoading` vs `uiIsLoading`).
- MoE step results render in a batch instead of progressively.
- “Clear Chat” during MoE doesn’t stop the pipeline, causing ghost writes to the Notebook after clearing.

Goal: Activate an orchestrated, testable plan that unifies UI state, delivers progressive MoE rendering, and makes Clear Chat robust, keeping Discussion mode unchanged.

## Key Challenges and Analysis

- State unification: A single UI loading flag (`uiIsLoading`) must gate inputs, selectors, and buttons across both modes.
- Progressive updates: Emit per‑step completion signals from `moeRunner.ts` and lift them to UI via `useMoeLogic.ts` without breaking stage gating (R1 parallel → R2 parallel → R3).
- Cancellation and clearing: A cancel flag must block downstream writes immediately; Clear Chat needs a “stop → clear → reset” sequence in MoE.
- Circuit breaker: If any parallel node fails, surface it clearly and stop the rest of the current run.
- Observability: Dev‑only logging of rendered prompts and a guard that warns when the Summarizer output doesn’t contain `<np-*>` tags.
- Image inputs: If provided, convert to base64 data URL and pass through the pipeline.

## High‑level Task Breakdown

A. Unify user message insertion & UI state
- App (`dual-ai-chat/App.tsx`)
  - MoE branch of `onSendMessageUnified`: insert the user message before starting MoE; include `image` metadata when present (base64 + name/type).
  - Replace top‑bar `disabled={isLoading...}` with `disabled={uiIsLoading...}` on model selectors and buttons.
  - Keep a single stop entry point that dispatches to MoE or Discussion.
- Success criteria
  - User’s message appears immediately in both modes; header controls and status consistently reflect `uiIsLoading`.
  - “Stop” routes to the correct implementation per mode.

C. Effective “Clear Chat” in MoE
- Hooks/UI
  - `useMoeLogic.ts`: add `resetMoeState()` to restore initial thinking states and clear cancel flags.
  - `App.tsx`: if MoE is running, call `stopMoeGenerating()` before clear; then `initializeChat()`; finally `resetMoeState()` to hide MoA bubble.
- Success criteria
  - Clearing during an active MoE session halts further writes; messages and Notebook are cleared; cards disappear.

B. Progressive display of MoE steps
- Services/Hooks
  - `moeRunner.ts`: add optional `onStepUpdate(MoaStepResult)` and invoke it right after each p1A/p1B/p2C/p2D resolves; still gate stages with `await Promise.all`.
  - `useMoeLogic.ts`: thread `onStepUpdate` through and update `stepsState` incrementally; ignore updates if cancelled.
- Success criteria
  - Cards render as each step finishes; R2 waits for R1 completion; Summarizer updates Notebook only.

D. Observability & Safeguards
- `roleRunner.ts`: dev‑only log a truncated rendered userPrompt and warn if unknown placeholders remain.
- Summarizer guard: Warn when no `<np-*>` tags are present.

E. QA & Regression
- Verify Discussion mode behavior and Clear Chat parity.
- Manual smoke for MoE: progressive cards, circuit breaker, stop/clear correctness.

Definition of Done
- All success criteria above satisfied; Discussion mode unchanged; no console errors; basic manual QA passes.

## Project Status Board

- [x] A1 Insert user message in MoE branch before start
- [x] A2 Convert image to base64 and attach metadata
- [x] A3 Top‑bar: switch `disabled` props to `uiIsLoading`
- [x] A4 Ensure unified stop function dispatches per mode
- [ ] C1 Add `resetMoeState()` in `useMoeLogic.ts`
- [ ] C2 App Clear Chat: stop → initialize → reset MoE state
- [ ] B1 Add `onStepUpdate` to `moeRunner.ts`
- [ ] B2 Wire `onStepUpdate` through `useMoeLogic.ts` to `stepsState`
- [ ] B3 Keep stage gating with `Promise.all`
 - [x] B1 Add `onStepUpdate` to `moeRunner.ts`
 - [x] B2 Wire `onStepUpdate` through `useMoeLogic.ts` to `stepsState`
 - [x] B3 Keep stage gating with `Promise.all`
- [ ] D1 Dev‑only prompt logging in `roleRunner.ts`
- [ ] D2 Summarizer Notebook‑tag guard and system message
- [ ] E1 Discussion mode regression check
- [ ] E2 MoE flow manual QA (progressive, stop, clear)

---

Channel-based Settings Refactor (API 渠道)

- [x] S1 SettingsModal: 三页签骨架（General/API Channels/Advanced），General 仅保留“文字大小”。
- [x] S2 API Channels: 列表与空态（读取 store）、新增/编辑/删除交互（调用 setProviders）。
- [ ] S3 ApiChannelForm: 精简为四字段（名称/提供商/API Key/超时），默认超时 300，隐藏能力复选并按类型设默认。
- [ ] S4 存储与迁移：SCHEMA_VERSION=2，迁移默认超时 300。
- [ ] S5 useChatLogic 改造为渠道/角色驱动；移除 legacy props；接入 roleRunner。
- [ ] S6 App.tsx 精简：移除旧 API 状态与欢迎文案分支；拼装 providersById + activeTeam；注入 hooks。
- [ ] S7 providerAdapter 增加超时控制；统一错误映射。

## Progress (Settings Refactor)

- 2025-09-11: 完成 S1。
  - 新增 `dual-ai-chat/components/settings/GeneralTab.tsx`、`.../ApiChannelsTab.tsx`、`.../AdvancedTab.tsx`。
  - 重写 `dual-ai-chat/components/SettingsModal.tsx` 为三页签容器；保留旧 props 类型兼容，但 UI 仅展示：
    - 常规设置：文字大小（小/中/大/特大）。
    - API 渠道：空态与只读列表骨架（编辑/删除暂禁用）。
    - 高级设置：占位文案。
  - 下一步 S2：在 API Channels 页签接入 store 的增/编/删，使用确认对话与引用校验（团队管理）。
\- 2025-09-11: 完成 S2。
  - `ApiChannelsTab` 现已接入 `useAppStore()`，呈现列表与空态，并提供“新增/编辑/删除”。
  - 新增/编辑：使用现有 `ApiChannelForm` 弹窗（后续 S3 再精简为四字段与必填校验）。
  - 删除：删除前执行团队引用校验（Discussion/MoE 全角色），若被引用则阻止并给出提示；否则二次确认后删除。
  - 下一步 S3：精简 `ApiChannelForm` 为四字段（名称/提供商/API Key/超时=300）并隐藏能力复选，按类型自动赋默认能力。

## Current Status / Progress Tracking

- 2025‑09‑10: Orchestra activated in Planner role; seeded architecture plan and tasks.
- 2025‑09‑10: Executor completed Step A.
  - Code: `dual-ai-chat/App.tsx` updated to insert user message in MoE path and pass image metadata; top‑bar disabled states and status bar now use `uiIsLoading`.
  - Verified by static review: `onSendMessageUnified` inserts user bubble before `startMoeProcessing`; model selectors and top buttons disabled on `uiIsLoading`; status bar reflects `uiIsLoading`.
- Bugfix: Preserve MoE历史气泡，形成连续对话流。
  - 在 App 侧新增 `moeRunHistory`，在新一轮 MoE 开始前快照上一轮 `stepsState` 并追加渲染；初始化/清空时一并重置。
  - UI：现在每轮用户发送后都会保留上一轮的 MoE 卡片，不会被新一轮覆盖。
- Bugfix: 对话时间轴交错排版。
  - 统一时间轴渲染：将 `messages`、`moeRunHistory` 与“当前 MoE 运行”融合为按时间排序的 timeline，交错渲染 `MessageBubble` 与 `MoaBubble`，避免按发送者分组聚集。
  - Bugfix: 用户消息乱序（第二轮出现在 MoE 卡片之后）。
    - `useChatLogic.ts` 与 `App.tsx`（MoE 分支）使用 `flushSync` 先同步插入用户消息，再做耗时操作（如 Base64 转换）和启动流程，确保“用户气泡”始终先于该轮的 MoE 卡片渲染。
 - 2025‑09‑10: Executor completed Step B.
   - `moeRunner.ts` 增加 `onStepUpdate(step)` 并在 p1A/p1B/p2C/p2D 各自完成时调用。
   - `useMoeLogic.ts` 透传回调并在未取消时渐进更新 `stepsState`，仍保持 R1→R2 的阶段依赖与最终落盘。

## Executor's Feedback or Assistance Requests

- Confirm: proceed to implement Step A now? (We’ll start with App header controls and MoE user‑message insertion.)
- Confirm: base64 image format requirements for providers (we currently pass `data:<mime>;base64,<data>` semantics where applicable).
- Any additional UI copy or telemetry preferences for errors/warnings?

## Lessons

- Include info useful for debugging in program output.
- Read files before editing; keep changes minimal and focused.
- If vulnerabilities appear in the terminal, run `npm audit` before proceeding.
