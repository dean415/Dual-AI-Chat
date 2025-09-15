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
      parts.push(`\n User's Request:\n${it.content}\n\n`);
    } else {
      parts.push(`\n\n${it.workflowName}'s Response to User:\n${it.content}\n\n`);
    }
  }
  return parts.join('\n\n');
}

// New: return N messages as individual role:'user' entries.
// Rules:
// - Merge real user inputs and notepad snapshots, same selection/sort as above.
// - For user messages: content = "User's Original Request: ${text}".
// - For notepad snapshots: content = "{workflow_name}'s response to user: ${content}" (placeholder, not resolved name).
// - Always return an array of { role: 'user', content }.
export function collectRecentMixedMessagesN(n: number): Array<{ role: 'user'; content: string }> {
  const chat = getActiveChat();
  if (!chat) return [];
  const safeN = Math.max(1, Math.min(50, Number(n) || 6));

  const items: MixedItem[] = [];

  try {
    const msgs = Array.isArray(chat.messages) ? chat.messages : [];
    for (const m of msgs) {
      if (!m) continue;
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
      // IMPORTANT: use placeholder instead of resolved name
      items.push({ type: 'notepad', content: s.content, at: s.at, workflowName: '{workflow_name}' });
    }
  } catch {}

  const picked = items
    .sort((a, b) => b.at - a.at)
    .slice(0, safeN)
    .sort((a, b) => a.at - b.at);

  const messages: Array<{ role: 'user'; content: string }> = [];
  for (const it of picked) {
    if (it.type === 'user') {
      messages.push({ role: 'user', content: `User's Original Request: ${it.content}` });
    } else {
      messages.push({ role: 'user', content: `{workflow_name}'s response to user: ${it.content}` });
    }
  }
  return messages;
}

// New: Prefer workflow runs — build strict Q→A pairs per run
// For each run, pair the closest preceding user message (Q) with the last step output of the last round (A).
// Returns flattened messages as role:'user' entries in chronological order (old → new).
export function collectRecentWorkflowPairsN(n: number): Array<{ role: 'user'; content: string }> {
  const chat = getActiveChat();
  if (!chat) return [];
  const safeN = Math.max(1, Math.min(50, Number(n) || 6));

  const runs = Array.isArray((chat as any).workflowRuns) ? (chat as any).workflowRuns as Array<{ id: string; startedAt: number; name?: string; rounds: Array<{ steps: Array<{ roleName?: string; content?: string; status?: string }> }> }> : [];
  if (!runs.length) return [];

  const userMsgs = (Array.isArray((chat as any).messages) ? (chat as any).messages : []).filter((m: any) => m && m.sender === MessageSender.User && typeof m.text === 'string' && m.text.trim());

  const pairs: Array<{ q: string; a: string; at: number; label: string }> = [];

  for (let i = runs.length - 1; i >= 0; i--) {
    const run = runs[i];
    const startedAt = typeof run.startedAt === 'number' ? run.startedAt : 0;
    const rounds = Array.isArray(run.rounds) ? run.rounds : [];
    const lastRound = rounds.length ? rounds[rounds.length - 1] : undefined;
    const steps = lastRound && Array.isArray((lastRound as any).steps) ? (lastRound as any).steps : [];
    const lastStep = steps.length ? steps[steps.length - 1] : undefined as any;
    const content = lastStep && typeof lastStep.content === 'string' ? lastStep.content.trim() : '';
    const status = lastStep && typeof lastStep.status === 'string' ? lastStep.status : 'thinking';
    if (!content || status !== 'done') continue; // skip empty or errored/unfinished

    // Find the closest preceding user message (<= startedAt)
    let bestQ: string | null = null;
    let bestAt: number = -Infinity;
    for (const m of userMsgs) {
      const t = tsOf((m as any).timestamp);
      if (t <= startedAt && t > bestAt) {
        bestAt = t;
        bestQ = String((m as any).text || '').trim();
      }
    }
    if (!bestQ) continue; // if we cannot pair, skip this run

    const labelSource = (typeof run.name === 'string' && run.name.trim()) ? run.name.trim() : (typeof lastStep?.roleName === 'string' ? String(lastStep.roleName) : 'Assistant');
    pairs.push({ q: bestQ, a: content, at: startedAt, label: labelSource });
    if (pairs.length >= safeN) break; // collected enough pairs
  }

  // We built from newest to oldest; output in chronological order
  pairs.sort((a, b) => a.at - b.at);

  const out: Array<{ role: 'user'; content: string }> = [];
  for (const p of pairs) {
    out.push({ role: 'user', content: `User's Original Request: ${p.q}` });
    out.push({ role: 'user', content: `${p.label}'s response to user: ${p.a}` });
  }
  return out;
}

// New: String variant for non-OpenAI providers — flattens Q→A pairs into a single text block
export function collectRecentWorkflowPairsStrN(n: number): string {
  const msgs = collectRecentWorkflowPairsN(n);
  if (!msgs.length) return '';
  // Group into pairs in order; msgs are already [Q, A, Q, A ...]
  const parts: string[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const it = msgs[i];
    parts.push(it.content);
  }
  return parts.join('\n\n');
}
