import { useCallback, useRef, useState } from 'react';
import type {
  ApiProviderConfig,
  RoleLibraryItem,
  WorkflowPresetMinimal,
  WorkflowRound,
  TranscriptMessage,
  RoleParameters,
} from '../types';
import type { ProviderErrorCode } from '../services/providerAdapter';
import { callModelWithMessages, callModelWithMessagesStream } from '../services/providerAdapter';
import type { OpenAiChatMessage } from '../services/openaiService';
import { generateUniqueId } from '../utils/appUtils';
import { beginWorkflowRun, appendWorkflowRound, setNotepadCurrent as persistNotepadCurrent } from '../utils/chatStore';
import { captureActiveChatId, isActiveChat } from '../utils/activeChatGuard';

export interface RoleOutputEvent {
  roundIndex: number;
  roleName: string;
  text?: string;
  durationMs?: number;
  errorCode?: ProviderErrorCode;
  errorMessage?: string;
}

export interface UseWorkflowOrchestratorProps {
  providers: ApiProviderConfig[];
  roleLibrary: RoleLibraryItem[];
  workflow: WorkflowPresetMinimal | null;
  getTranscript: () => TranscriptMessage[];
  setTranscript: (next: TranscriptMessage[]) => void;
  getFinalNotepadContent: () => string; // snapshot after all rounds complete
  onRoleOutput?: (evt: RoleOutputEvent) => void; // final output per role
  onRoleDelta?: (evt: { roundIndex: number; roleName: string; textDelta: string }) => void; // streaming deltas
  onStreamingFallback?: (evt: { roundIndex: number; roleName: string; message?: string }) => void; // notify when falling back
  onRoleMessagesPreview?: (evt: { roundIndex: number; roleName: string; preview: Array<{ role: string; name?: string; content: string }> }) => void;
  // Optional per-chat wiring
  getUserHistory?: () => Array<{ content: string; at: number }>;
  appendRoundMessage?: (roundIndex: number, content: string) => void;
  appendNotepadSnapshot?: (content: string, at: number) => void;
  // Streaming prefs
  enableStreaming?: boolean;
  streamIntervalMs?: number;
}

export interface UseWorkflowOrchestratorResult {
  isRunning: boolean;
  runWorkflow: (userInput: string) => Promise<void>;
  stop: () => void;
}

type PerRunOutput = { roundIndex: number; content: string };

export function useWorkflowOrchestrator({
  providers,
  roleLibrary,
  workflow,
  getTranscript,
  setTranscript,
  getFinalNotepadContent,
  onRoleOutput,
  onRoleMessagesPreview,
  getUserHistory,
  appendRoundMessage,
  appendNotepadSnapshot,
  disableLegacyTranscript,
  onRoleDelta,
  onStreamingFallback,
  enableStreaming = true,
  streamIntervalMs = 30,
}: UseWorkflowOrchestratorProps): UseWorkflowOrchestratorResult {
  const [isRunning, setIsRunning] = useState(false);
  const cancelRef = useRef(false);
  const runIdRef = useRef<string | null>(null);
  const runChatIdRef = useRef<string | null>(null);
  // Track active streaming cancels per role per round: `${roundIndex}:${roleName}` -> cancel()
  const activeCancelsRef = useRef<Record<string, () => void>>({});
  // Light throttling for streaming deltas (buffer + 30ms timer per role)
  const deltaBuffersRef = useRef<Record<string, string>>({});
  const deltaTimersRef = useRef<Record<string, number>>({});

  const flushDeltaNow = useCallback((key: string, roundIndex: number, roleName: string) => {
    const buf = deltaBuffersRef.current[key];
    if (buf && buf.length > 0) {
      try { onRoleDelta?.({ roundIndex, roleName, textDelta: buf }); } catch {}
      deltaBuffersRef.current[key] = '';
    }
    const t = deltaTimersRef.current[key];
    if (t) {
      try { clearTimeout(t); } catch {}
      delete deltaTimersRef.current[key];
    }
  }, [onRoleDelta]);

  const enqueueDelta = useCallback((key: string, roundIndex: number, roleName: string, chunk: string) => {
    deltaBuffersRef.current[key] = (deltaBuffersRef.current[key] || '') + (chunk || '');
    if (!deltaTimersRef.current[key]) {
      deltaTimersRef.current[key] = window.setTimeout(() => {
        flushDeltaNow(key, roundIndex, roleName);
      }, Math.max(0, Number(streamIntervalMs) || 30));
    }
  }, [flushDeltaNow, streamIntervalMs]);

  const providerById = useRef<Record<string, ApiProviderConfig>>({});
  const roleByName = useRef<Record<string, RoleLibraryItem>>({});
  const getUserHistoryRef = useRef<UseWorkflowOrchestratorProps['getUserHistory']>();
  const appendRoundMessageRef = useRef<UseWorkflowOrchestratorProps['appendRoundMessage']>();
  const appendNotepadSnapshotRef = useRef<UseWorkflowOrchestratorProps['appendNotepadSnapshot']>();

  // Build quick lookups whenever inputs change
  providerById.current = providers.reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as Record<string, ApiProviderConfig>);
  roleByName.current = roleLibrary.reduce((acc, r) => { acc[r.name] = r; return acc; }, {} as Record<string, RoleLibraryItem>);
  getUserHistoryRef.current = getUserHistory;
  appendRoundMessageRef.current = appendRoundMessage;
  appendNotepadSnapshotRef.current = appendNotepadSnapshot;

  const takeHistoryN = (N: number, transcript: TranscriptMessage[], beforeTs: number): OpenAiChatMessage[] => {
    if (!N || N <= 0) return [];
    // Prefer per-chat user history when available
    if (typeof getUserHistoryRef.current === 'function') {
      try {
        const hist = (getUserHistoryRef.current() || []).filter(m => typeof m.at === 'number' && m.at < beforeTs);
        const slice = hist.slice(-N);
        return slice.map(m => ({ role: 'user', content: m.content }));
      } catch {}
    }
    // Fallback to legacy transcript (user only)
    const filtered = transcript.filter(m => (m.role === 'user') && m.at < beforeTs);
    const slice = filtered.slice(-N);
    return slice.map(m => ({ role: 'user', content: m.content }));
  };

  const latestOutputOf = (perRun: Record<string, PerRunOutput[]>, roleName: string, beforeRoundIndex: number): string | undefined => {
    const arr = perRun[roleName];
    if (!arr || !arr.length) return undefined;
    // pick the latest with roundIndex < beforeRoundIndex
    for (let i = arr.length - 1; i >= 0; i--) {
      const it = arr[i];
      if (it.roundIndex < beforeRoundIndex) return it.content;
    }
    return undefined;
  };

  const runWorkflow = useCallback(async (userInput: string) => {
    if (!workflow || !workflow.rounds || workflow.rounds.length === 0) return;
    if (isRunning) return;
    cancelRef.current = false;
    setIsRunning(true);
    const runStartTs = Date.now();
    // Step 5: capture chat id and begin run persistently (Option B)
    const capturedChatId = captureActiveChatId();
    runChatIdRef.current = capturedChatId;
    const newRunId = 'run-' + generateUniqueId();
    runIdRef.current = newRunId;
    try {
      if (isActiveChat(capturedChatId)) {
        beginWorkflowRun(newRunId, { name: workflow?.name, startedAt: runStartTs });
      }
    } catch {}

    // Per-run outputs for receiveFrom lookup
    const perRunOutputs: Record<string, PerRunOutput[]> = {};

    try {
      const rounds = workflow.rounds as WorkflowRound[];
      for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
        if (cancelRef.current) break;
        const round = rounds[roundIndex];
        const roles = (round.roles || []).slice(0, 4);
        // Track per-role outcome for this round
        const stepState: Record<string, { status: 'done' | 'error'; content?: string; error?: string; durationMs?: number }> = {};
        const tasks = roles.map(async (roleName) => {
          const libRole = roleByName.current[roleName];
          if (!libRole) {
            onRoleOutput?.({ roundIndex, roleName, errorCode: 'INVALID_REQUEST', errorMessage: `未找到角色：${roleName}` });
            stepState[roleName] = { status: 'error', error: `未找到角色：${roleName}` };
            return;
          }
          const provider = providerById.current[libRole.providerId];
          if (!provider) {
            onRoleOutput?.({ roundIndex, roleName, errorCode: 'INVALID_REQUEST', errorMessage: `未找到渠道：${libRole.providerId}` });
            stepState[roleName] = { status: 'error', error: `未找到渠道：${libRole.providerId}` };
            return;
          }

          // Assemble messages per new rules:
          // [system?] → historyN (only real user msgs) → (non-first-round: Original Request restated) → receiveFrom (as user messages) → current user (first-round only)
          const messages: OpenAiChatMessage[] = [];
          if (libRole.systemPrompt && libRole.systemPrompt.trim()) {
            messages.push({ role: 'system', content: libRole.systemPrompt });
          }

          const transcript = getTranscript();
          const perRole = round.perRole && round.perRole[roleName];
          const N = (perRole && perRole.historyN) ? perRole.historyN : 0;
          if (N) {
            messages.push(...takeHistoryN(N, transcript, runStartTs));
          }

          const receiveFrom = (perRole && perRole.receiveFrom) ? perRole.receiveFrom : [];

          // Non-first rounds: restate the original user request as a user message
          if (roundIndex > 0) {
            messages.push({ role: 'user', content: `User's Original Request：---\n${userInput}\n\n` });
          }

          // Include selected previous roles' outputs as individual user messages
          for (const fromName of receiveFrom) {
            const content = latestOutputOf(perRunOutputs, fromName, roundIndex);
            if (content && content.trim()) {
              messages.push({ role: 'user', content: `\n\n${fromName}'s response to the User's Original Request:---\n"${content}"\n\n` });
            }
          }

          // First round: pass the raw user prompt as-is
          if (roundIndex === 0) {
            messages.push({ role: 'user', content: userInput });
          }

          // Build debug preview (trim content to first 5 chars and include assistant name when present)
          try {
            const preview = messages.map(m => {
              const raw = Array.isArray(m.content)
                ? m.content.map(p => (p as any)?.type === 'text' ? (p as any).text : '[img]').join(' ')
                : (m.content as any) || '';
              const txt = String(raw).replace(/\s+/g, ' ').trim();
              const short = txt.length > 5 ? txt.slice(0, 5) + '…' : txt;
              const item: any = { role: m.role, content: short };
              if ((m as any).name) item.name = (m as any).name;
              return item;
            });
            onRoleMessagesPreview?.({ roundIndex, roleName, preview });
          } catch {}

          let res: { text: string; durationMs: number; errorCode?: ProviderErrorCode; errorMessage?: string };
          const roleStream = (enableStreaming !== false) && (typeof (libRole as any)?.streamingEnabled === 'boolean' ? !!(libRole as any).streamingEnabled : true);
          if (provider.providerType === 'openai' && roleStream) {
            let acc = '';
            const key = `${roundIndex}:${roleName}`;
            res = await new Promise(async (resolve) => {
              let settled = false;
              const handle = callModelWithMessagesStream({
                provider,
                modelId: libRole.modelId,
                messages,
                parameters: libRole.parameters as RoleParameters | undefined,
                onDelta: (chunk) => {
                  if (cancelRef.current) return;
                  acc += chunk;
                  enqueueDelta(key, roundIndex, roleName, chunk);
                },
                onError: async (_err) => {
                  if (cancelRef.current) return;
                  // Fallback to non-streaming when streaming fails (e.g., SSE/CORS)
                  try { activeCancelsRef.current[key]?.(); } catch {}
                  // flush any buffered text before falling back
                  try { flushDeltaNow(key, roundIndex, roleName); } catch {}
                  // notify UI about fallback
                  try { onStreamingFallback?.({ roundIndex, roleName, message: 'Streaming not available. Falling back to non-streaming.' }); } catch {}
                  try {
                    const fb = await callModelWithMessages({
                      provider,
                      modelId: libRole.modelId,
                      messages,
                      parameters: libRole.parameters as RoleParameters | undefined,
                    });
                    if (!settled) { settled = true; resolve(fb); }
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    if (!settled) { settled = true; resolve({ text: msg, durationMs: 0, errorCode: 'UNKNOWN', errorMessage: msg }); }
                  }
                },
              });
              activeCancelsRef.current[key] = handle.cancel;
              try {
                const r = await handle.done;
                // final flush of any remaining buffered text
                try { flushDeltaNow(key, roundIndex, roleName); } catch {}
                if (!settled) { settled = true; resolve(r); }
              } finally {
                delete activeCancelsRef.current[key];
              }
            });
          } else {
           res = await callModelWithMessages({
             provider,
             modelId: libRole.modelId,
             messages,
             parameters: libRole.parameters as RoleParameters | undefined,
           });
          }

          if (cancelRef.current) return;

          if (res.errorCode) {
            onRoleOutput?.({ roundIndex, roleName, errorCode: res.errorCode, errorMessage: res.errorMessage, durationMs: res.durationMs });
            stepState[roleName] = { status: 'error', error: res.errorMessage || res.errorCode, durationMs: res.durationMs };
          } else {
            const text = res.text || '';
            if (!perRunOutputs[roleName]) perRunOutputs[roleName] = [];
            perRunOutputs[roleName].push({ roundIndex, content: text });
            onRoleOutput?.({ roundIndex, roleName, text, durationMs: res.durationMs });
            stepState[roleName] = { status: 'done', content: text, durationMs: res.durationMs };
          }
        });

        // Parallel within round
        await Promise.all(tasks);

        // After round completion, build flat Round N message and optionally append to chat
        try {
          if (appendRoundMessageRef.current) {
            const parts: string[] = [];
            parts.push(`Round ${roundIndex + 1}`);
            for (const rn of roles) {
              const arr = perRunOutputs[rn];
              const item = Array.isArray(arr) ? arr.find(it => it.roundIndex === roundIndex) : undefined;
              const text = item && item.content ? String(item.content).trim() : '';
              if (text) {
                parts.push(`${rn}:\n${text}`);
              }
            }
            const flat = parts.join('\n\n');
            appendRoundMessageRef.current(roundIndex, flat);
          }
        } catch {}

        // Step 6: Persist round structure if still on the same chat
        try {
          const rcid = runChatIdRef.current;
          const rid = runIdRef.current;
          if (rcid && rid && isActiveChat(rcid)) {
            const steps = roles.map((rn) => {
              const st = stepState[rn];
              const libRole = roleByName.current[rn];
              const provider = libRole ? providerById.current[libRole.providerId] : undefined;
              const brand = (provider && (provider as any).brandKey) ? (provider as any).brandKey : undefined;
              return {
                roleName: rn,
                content: (st && st.content) ? st.content : '',
                status: (st && st.status) ? st.status : 'error',
                durationMs: st?.durationMs,
                error: st?.error,
                brand,
              } as any;
            });
            appendWorkflowRound(rid, { steps } as any);
          }
        } catch {}
      }

      if (!cancelRef.current) {
        // Append current user and final notepad snapshot to transcript
        const finalContent = getFinalNotepadContent();
        if (!disableLegacyTranscript) {
          const prev = getTranscript();
          setTranscript([
            ...prev,
            { role: 'user', content: userInput, at: runStartTs },
            { role: 'assistant_notepad', content: finalContent, at: Date.now() },
          ]);
        }
        try {
          if (appendNotepadSnapshotRef.current) {
            appendNotepadSnapshotRef.current(finalContent, Date.now());
          }
        } catch {}
        // Step 7: Force-sync current Canvas text to chat for quick restore
        try { if (isActiveChat(runChatIdRef.current || '')) persistNotepadCurrent(finalContent); } catch {}
      }
    } finally {
      setIsRunning(false);
    }
  }, [workflow, isRunning, getTranscript, setTranscript, getFinalNotepadContent, onRoleOutput]);
  // include onRoleMessagesPreview in deps is unnecessary since it's a function prop; omitting to avoid reruns

  const stop = useCallback(() => {
    cancelRef.current = true;
    // Cancel all in-flight streaming requests
    try {
      const keys = Object.keys(activeCancelsRef.current || {});
      for (const k of keys) {
        try { activeCancelsRef.current[k]?.(); } catch {}
      }
    } finally {
      activeCancelsRef.current = { };
    }
    // Clear all pending delta timers (prevent late flush after stop)
    try {
      const tkeys = Object.keys(deltaTimersRef.current || {});
      for (const k of tkeys) {
        try { clearTimeout(deltaTimersRef.current[k]); } catch {}
      }
    } finally {
      deltaTimersRef.current = { } as Record<string, number>;
    }
  }, []);

  return { isRunning, runWorkflow, stop };
}

export default useWorkflowOrchestrator;
