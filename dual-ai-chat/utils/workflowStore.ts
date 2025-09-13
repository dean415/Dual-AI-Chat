import { STORAGE_KEYS, load, save } from './storage';
import type { RoleLibraryItem, WorkflowPresetMinimal, TranscriptMessage } from '../types';

// Typed getters/setters for custom workflow persistence

export const WORKFLOW_STORE_EVENT = 'dualAiChat.workflowStoreChanged';

function notify(key: string) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(WORKFLOW_STORE_EVENT, { detail: { key } }));
    }
  } catch {}
}

export function subscribeWorkflowStore(listener: (e: CustomEvent<{ key: string }>) => void) {
  const handler = (ev: Event) => {
    try {
      const ce = ev as CustomEvent<{ key: string }>;
      listener(ce);
    } catch {}
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(WORKFLOW_STORE_EVENT, handler as EventListener);
    // Also listen to storage events from other tabs (best-effort)
    window.addEventListener('storage', () => listener(new CustomEvent(WORKFLOW_STORE_EVENT, { detail: { key: 'storage' } })) as any);
    return () => {
      window.removeEventListener(WORKFLOW_STORE_EVENT, handler as EventListener);
      window.removeEventListener('storage', () => listener(new CustomEvent(WORKFLOW_STORE_EVENT, { detail: { key: 'storage' } })) as any);
    };
  }
  return () => {};
}

export function getRoleLibrary(): RoleLibraryItem[] {
  return load<RoleLibraryItem[]>(STORAGE_KEYS.roleLibrary, []);
}

export function setRoleLibrary(items: RoleLibraryItem[]) {
  save(STORAGE_KEYS.roleLibrary, items || []);
  notify(STORAGE_KEYS.roleLibrary);
}

export function getWorkflowPresets(): WorkflowPresetMinimal[] {
  return load<WorkflowPresetMinimal[]>(STORAGE_KEYS.workflowPresets, []);
}

export function setWorkflowPresets(items: WorkflowPresetMinimal[]) {
  save(STORAGE_KEYS.workflowPresets, items || []);
  notify(STORAGE_KEYS.workflowPresets);
}

export function getActiveWorkflowId(): string {
  return load<string>(STORAGE_KEYS.activeWorkflowId, '');
}

export function setActiveWorkflowId(id: string) {
  save(STORAGE_KEYS.activeWorkflowId, id || '');
  notify(STORAGE_KEYS.activeWorkflowId);
}

export function getTranscript(): TranscriptMessage[] {
  return load<TranscriptMessage[]>(STORAGE_KEYS.transcript, []);
}

export function setTranscript(messages: TranscriptMessage[]) {
  save(STORAGE_KEYS.transcript, messages || []);
  notify(STORAGE_KEYS.transcript);
}

export function appendTranscript(message: TranscriptMessage) {
  const cur = getTranscript();
  save(STORAGE_KEYS.transcript, [...cur, message]);
  notify(STORAGE_KEYS.transcript);
}
