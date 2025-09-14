import { getActiveChatId } from './chatStore';

export type RunChatId = string;

// Capture the active chat id at workflow start
export function captureActiveChatId(): RunChatId {
  return getActiveChatId();
}

// Check if the captured id still matches the current active chat
export function isActiveChat(runChatId: RunChatId): boolean {
  const current = getActiveChatId();
  return !!runChatId && !!current && runChatId === current;
}

// Convenience wrapper to skip actions if chat changed mid-run
export function withActiveChatGuard<T>(runChatId: RunChatId, action: () => T): { proceeded: boolean; result?: T } {
  if (!isActiveChat(runChatId)) return { proceeded: false };
  return { proceeded: true, result: action() };
}

