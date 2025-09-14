// Minimal utilities for Prompt Optimizer context collection
// English-only comments as requested.

import { getActiveChat } from './chatStore';
import { getWorkflowPresets } from './workflowStore';
import type { Chat } from '../types';
import { MessageSender, MessagePurpose } from '../types';

type MixedItem =
  | { at: number; type: 'user'; content: string }
  | { at: number; type: 'notepad'; content: string; workflowName: string };

function tsOf(val: unknown): number {
  try {
    if (val instanceof Date) return val.getTime();
    // Fallback: attempt to coerce
    const d = new Date(val as any);
    const t = d.getTime();
    return isNaN(t) ? Date.now() : t;
  } catch {
    return Date.now();
  }
}

export function resolveWorkflowNameForSnapshot(chat: Chat, at: number): string {
  try {
    // Prefer a run whose startedAt <= snapshot time, take the latest
    const runs = Array.isArray((chat as any).workflowRuns) ? (chat as any).workflowRuns as Array<{ startedAt: number; name?: string }> : [];
    let pick: { startedAt: number; name?: string } | null = null;
    for (const r of runs) {
      const st = typeof r.startedAt === 'number' ? r.startedAt : 0;
      if (st <= at && (!pick || st > pick.startedAt)) pick = r;
    }
    if (pick && typeof pick.name === 'string' && pick.name.trim()) return pick.name.trim();
  } catch {}
  try {
    // Fallback to active workflow name on the chat
    const wfId = (chat as any).workflowId as string | undefined;
    if (wfId && typeof wfId === 'string') {
      const list = getWorkflowPresets();
      const found = list.find(w => w.id === wfId);
      if (found && typeof found.name === 'string' && found.name.trim()) return found.name.trim();
    }
  } catch {}
  return 'Workflow';
}

export function collectRecentMixedHistoryN(n: number): string {
  const chat = getActiveChat();
  if (!chat) return '';
  const safeN = Math.max(1, Math.min(50, Number(n) || 6));

  const items: MixedItem[] = [];

  try {
    const msgs = Array.isArray(chat.messages) ? chat.messages : [];
    for (const m of msgs) {
      if (!m) continue;
      // Only real user messages (optional: also check purpose)
      if (m.sender === MessageSender.User && typeof m.text === 'string' && m.text.trim()) {
        if (m.purpose === undefined || m.purpose === MessagePurpose.UserInput) {
          items.push({ type: 'user', content: m.text, at: tsOf(m.timestamp) });
        }
      }
    }
  } catch {}

  try {
    const snaps = Array.isArray((chat as any).notepadSnapshots) ? (chat as any).notepadSnapshots as Array<{ at: number; content: string }> : [];
    for (const s of snaps) {
      if (!s || typeof s.content !== 'string' || !s.content.trim()) continue;
      const name = resolveWorkflowNameForSnapshot(chat, s.at);
      items.push({ type: 'notepad', content: s.content, at: s.at, workflowName: name });
    }
  } catch {}

  // Sort by time desc, take N, then reorder asc for readability
  const picked = items
    .sort((a, b) => b.at - a.at)
    .slice(0, safeN)
    .sort((a, b) => a.at - b.at);

  const parts: string[] = [];
  for (const it of picked) {
    if (it.type === 'user') {
      parts.push(`User's Request:\n${it.content}`);
    } else {
      parts.push(`${it.workflowName}'s Response to User:\n${it.content}`);
    }
  }
  return parts.join('\n\n');
}

