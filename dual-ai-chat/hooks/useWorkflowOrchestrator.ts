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
import { callModelWithMessages } from '../services/providerAdapter';
import type { OpenAiChatMessage } from '../services/openaiService';

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
  onRoleOutput?: (evt: RoleOutputEvent) => void; // progressive updates
  onRoleMessagesPreview?: (evt: { roundIndex: number; roleName: string; preview: Array<{ role: string; name?: string; content: string }> }) => void;
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
}: UseWorkflowOrchestratorProps): UseWorkflowOrchestratorResult {
  const [isRunning, setIsRunning] = useState(false);
  const cancelRef = useRef(false);

  const providerById = useRef<Record<string, ApiProviderConfig>>({});
  const roleByName = useRef<Record<string, RoleLibraryItem>>({});

  // Build quick lookups whenever inputs change
  providerById.current = providers.reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as Record<string, ApiProviderConfig>);
  roleByName.current = roleLibrary.reduce((acc, r) => { acc[r.name] = r; return acc; }, {} as Record<string, RoleLibraryItem>);

  const takeHistoryN = (N: number, transcript: TranscriptMessage[], beforeTs: number): OpenAiChatMessage[] => {
    if (!N || N <= 0) return [];
    const filtered = transcript.filter(m => (m.role === 'user' || m.role === 'assistant_notepad') && m.at < beforeTs);
    const slice = filtered.slice(-N);
    const msgs: OpenAiChatMessage[] = slice.map(m => {
      if (m.role === 'user') return { role: 'user', content: m.content };
      return { role: 'assistant', content: m.content };
    });
    return msgs;
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

    // Per-run outputs for receiveFrom lookup
    const perRunOutputs: Record<string, PerRunOutput[]> = {};

    try {
      const rounds = workflow.rounds as WorkflowRound[];
      for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
        if (cancelRef.current) break;
        const round = rounds[roundIndex];
        const roles = (round.roles || []).slice(0, 4);
        const tasks = roles.map(async (roleName) => {
          const libRole = roleByName.current[roleName];
          if (!libRole) {
            onRoleOutput?.({ roundIndex, roleName, errorCode: 'INVALID_REQUEST', errorMessage: `未找到角色：${roleName}` });
            return;
          }
          const provider = providerById.current[libRole.providerId];
          if (!provider) {
            onRoleOutput?.({ roundIndex, roleName, errorCode: 'INVALID_REQUEST', errorMessage: `未找到渠道：${libRole.providerId}` });
            return;
          }

          // Assemble messages: [system?] → historyN → receiveFrom → current user
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
          for (const fromName of receiveFrom) {
            const content = latestOutputOf(perRunOutputs, fromName, roundIndex);
            if (content && content.trim()) {
              messages.push({ role: 'assistant', name: fromName, content });
            }
          }

          messages.push({ role: 'user', content: userInput });

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

          const res = await callModelWithMessages({
            provider,
            modelId: libRole.modelId,
            messages,
            parameters: libRole.parameters as RoleParameters | undefined,
          });

          if (cancelRef.current) return;

          if (res.errorCode) {
            onRoleOutput?.({ roundIndex, roleName, errorCode: res.errorCode, errorMessage: res.errorMessage, durationMs: res.durationMs });
          } else {
            const text = res.text || '';
            if (!perRunOutputs[roleName]) perRunOutputs[roleName] = [];
            perRunOutputs[roleName].push({ roundIndex, content: text });
            onRoleOutput?.({ roundIndex, roleName, text, durationMs: res.durationMs });
          }
        });

        // Parallel within round
        await Promise.all(tasks);
      }

      if (!cancelRef.current) {
        // Append current user and final notepad snapshot to transcript
        const finalContent = getFinalNotepadContent();
        const prev = getTranscript();
        setTranscript([
          ...prev,
          { role: 'user', content: userInput, at: runStartTs },
          { role: 'assistant_notepad', content: finalContent, at: Date.now() },
        ]);
      }
    } finally {
      setIsRunning(false);
    }
  }, [workflow, isRunning, getTranscript, setTranscript, getFinalNotepadContent, onRoleOutput]);
  // include onRoleMessagesPreview in deps is unnecessary since it's a function prop; omitting to avoid reruns

  const stop = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return { isRunning, runWorkflow, stop };
}

export default useWorkflowOrchestrator;
