import { STORAGE_KEYS, load, save } from './storage';
import type { Chat, ChatMessage, WorkflowRoundRecord, WorkflowRunRecord } from '../types';
import { generateUniqueId } from './appUtils';

// Event name for consumers to subscribe and react to chat store changes
export const CHAT_STORE_EVENT = 'dualAiChat.chatStoreChanged';

function notify(key: string) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(CHAT_STORE_EVENT, { detail: { key } }));
    }
  } catch {}
}

// Simple in-memory cache to avoid stale reads between throttled localStorage saves
let chatsCache: Chat[] | null = null;
let activeChatIdCache: string | null = null;

export function subscribeChatStore(listener: (e: CustomEvent<{ key: string }>) => void) {
  const handler = (ev: Event) => {
    try {
      const ce = ev as CustomEvent<{ key: string }>;
      listener(ce);
    } catch {}
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(CHAT_STORE_EVENT, handler as EventListener);
    // Cross-tab sync
    window.addEventListener('storage', () => listener(new CustomEvent(CHAT_STORE_EVENT, { detail: { key: 'storage' } })) as any);
    return () => {
      window.removeEventListener(CHAT_STORE_EVENT, handler as EventListener);
      window.removeEventListener('storage', () => listener(new CustomEvent(CHAT_STORE_EVENT, { detail: { key: 'storage' } })) as any);
    };
  }
  return () => {};
}

export function getChats(): Chat[] {
  if (Array.isArray(chatsCache)) return chatsCache as Chat[];
  chatsCache = load<Chat[]>(STORAGE_KEYS.chats, []);
  return chatsCache;
}

export function setChats(items: Chat[]) {
  chatsCache = items || [];
  save(STORAGE_KEYS.chats, chatsCache);
  notify(STORAGE_KEYS.chats);
}

export function getActiveChatId(): string {
  if (typeof activeChatIdCache === 'string') return activeChatIdCache;
  activeChatIdCache = load<string>(STORAGE_KEYS.activeChatId, '');
  return activeChatIdCache || '';
}

export function setActiveChatId(id: string) {
  activeChatIdCache = id || '';
  save(STORAGE_KEYS.activeChatId, activeChatIdCache);
  notify(STORAGE_KEYS.activeChatId);
}

export function getActiveChat(): Chat | null {
  const id = getActiveChatId();
  if (!id) return null;
  const list = getChats();
  return list.find(c => c.id === id) || null;
}

// Create a new chat object with default title and empty contents
export function createChat(title: string = 'New Chat'): Chat {
  const now = Date.now();
  const id = 'chat-' + generateUniqueId();
  return {
    id,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
    notepadSnapshots: [],
    // New defaults for Option B persistence
    workflowRuns: [],
    notepadCurrent: '',
  };
}

// Ensure there is at least one chat and an activeChatId; create and activate if absent
export function ensureInitialChat(): { created: boolean; id: string } {
  let chats = getChats();
  let activeId = getActiveChatId();
  if (chats.length === 0) {
    const first = createChat();
    chats = [first];
    setChats(chats);
    setActiveChatId(first.id);
    return { created: true, id: first.id };
  }
  if (!activeId) {
    activeId = chats[0].id;
    setActiveChatId(activeId);
    return { created: false, id: activeId };
  }
  return { created: false, id: activeId };
}

export function renameChat(id: string, title: string) {
  const list = getChats();
  const idx = list.findIndex(c => c.id === id);
  if (idx < 0) return;
  const updated = { ...list[idx], title: title || list[idx].title, updatedAt: Date.now() } as Chat;
  const next = [...list];
  next[idx] = updated;
  setChats(next);
}

export function deleteChat(id: string) {
  const list = getChats();
  const idx = list.findIndex(c => c.id === id);
  if (idx < 0) return;
  const next = list.filter(c => c.id !== id);
  setChats(next);
  const active = getActiveChatId();
  if (active === id) {
    // Select next by order; if none, create new
    if (next.length > 0) {
      const nextIdx = Math.min(idx, next.length - 1);
      setActiveChatId(next[nextIdx].id);
    } else {
      const created = createChat();
      setChats([created]);
      setActiveChatId(created.id);
    }
  }
}

// Set workflowId for the active chat
export function setActiveChatWorkflow(workflowId: string) {
  const list = getChats();
  const activeId = getActiveChatId();
  if (!activeId) return;
  const idx = list.findIndex(c => c.id === activeId);
  if (idx < 0) return;
  const chat = list[idx];
  const updated: Chat = { ...chat, workflowId, updatedAt: Date.now() };
  const next = [...list];
  next[idx] = updated;
  setChats(next);
}

// Append a message to the active chat (returns new message id)
export function appendMessageToActiveChat(message: Omit<ChatMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: Date }): string | null {
  const list = getChats();
  const activeId = getActiveChatId();
  if (!activeId) return null;
  const idx = list.findIndex(c => c.id === activeId);
  if (idx < 0) return null;
  const msgId = message.id || generateUniqueId();
  const ts = message.timestamp || new Date();
  const toInsert: ChatMessage = { ...message, id: msgId, timestamp: ts } as ChatMessage;
  const chat = list[idx];
  const updated: Chat = { ...chat, messages: [...(chat.messages || []), toInsert], updatedAt: Date.now() };
  const next = [...list];
  next[idx] = updated;
  setChats(next);
  notify(STORAGE_KEYS.chats);
  return msgId;
}

// Append a notepad snapshot to the active chat
export function appendNotepadSnapshotToActiveChat(content: string, at: number) {
  const list = getChats();
  const activeId = getActiveChatId();
  if (!activeId) return;
  const idx = list.findIndex(c => c.id === activeId);
  if (idx < 0) return;
  const chat = list[idx];
  const updated: Chat = { ...chat, notepadSnapshots: [...(chat.notepadSnapshots || []), { at, content }], updatedAt: Date.now() };
  const next = [...list];
  next[idx] = updated;
  setChats(next);
  notify(STORAGE_KEYS.chats);
}

// Get only user-typed history (content + at) from active chat
export function getActiveChatUserHistory(): Array<{ content: string; at: number }> {
  const active = getActiveChat();
  if (!active) return [];
  const arr = (active.messages || []).filter(m => m && m.sender === '用户');
  return arr.map(m => ({ content: m.text, at: (m.timestamp as any as Date).getTime?.() || Date.now() }));
}

// ===== Workflow persistence helpers (Option B) =====

// Begin a new workflow run on the active chat (idempotent by runId)
export function beginWorkflowRun(runId: string, meta?: { name?: string; startedAt?: number }): boolean {
  const list = getChats();
  const activeId = getActiveChatId();
  if (!activeId) return false;
  const idx = list.findIndex(c => c.id === activeId);
  if (idx < 0) return false;
  const chat = list[idx];
  const runs = Array.isArray((chat as any).workflowRuns) ? ([...(chat as any).workflowRuns] as WorkflowRunRecord[]) : [];
  if (runs.some(r => r.id === runId)) {
    // Already exists; treat as success (idempotent)
    return true;
  }
  const newRun: WorkflowRunRecord = {
    id: runId,
    startedAt: meta?.startedAt ?? Date.now(),
    name: meta?.name,
    rounds: [],
  };
  const updated: Chat = { ...(chat as any), workflowRuns: [...runs, newRun], updatedAt: Date.now() } as Chat;
  const next = [...list];
  next[idx] = updated;
  setChats(next);
  notify(STORAGE_KEYS.chats);
  return true;
}

// Append a completed round to an existing workflow run on the active chat
export function appendWorkflowRound(runId: string, round: WorkflowRoundRecord): boolean {
  const list = getChats();
  const activeId = getActiveChatId();
  if (!activeId) return false;
  const idx = list.findIndex(c => c.id === activeId);
  if (idx < 0) return false;
  const chat = list[idx] as any;
  const runs: WorkflowRunRecord[] = Array.isArray(chat.workflowRuns) ? chat.workflowRuns : [];
  const rIdx = runs.findIndex((r: WorkflowRunRecord) => r.id === runId);
  if (rIdx < 0) return false;
  const run = runs[rIdx];
  const updatedRun: WorkflowRunRecord = { ...run, rounds: [...(run.rounds || []), round] };
  const nextRuns = [...runs];
  nextRuns[rIdx] = updatedRun;
  const updated: Chat = { ...(chat as Chat), workflowRuns: nextRuns, updatedAt: Date.now() } as Chat;
  const next = [...list];
  next[idx] = updated;
  setChats(next);
  notify(STORAGE_KEYS.chats);
  return true;
}

// Set the current Canvas text for the active chat (debounce handled by storage.save)
export function setNotepadCurrent(text: string) {
  const list = getChats();
  const activeId = getActiveChatId();
  if (!activeId) return;
  const idx = list.findIndex(c => c.id === activeId);
  if (idx < 0) return;
  const chat = list[idx] as any;
  const updated: Chat = { ...(chat as Chat), notepadCurrent: text ?? '', updatedAt: Date.now() } as Chat;
  const next = [...list];
  next[idx] = updated;
  setChats(next);
  notify(STORAGE_KEYS.chats);
}
