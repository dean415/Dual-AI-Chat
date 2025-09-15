import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { getWorkflowPresets } from '../utils/workflowStore';
import { getActiveChat, setActiveChatWorkflow, subscribeChatStore } from '../utils/chatStore';

const WorkflowSelector: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [wfVersion, setWfVersion] = useState(0);
  const [chatVersion, setChatVersion] = useState(0);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return;
      const el = dropdownRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  useEffect(() => {
    // best-effort: whenever chat changes, bump version
    const unsub = subscribeChatStore(() => setChatVersion(v => v + 1));
    return () => unsub();
  }, []);

  const workflows = useMemo(() => getWorkflowPresets(), [wfVersion, chatVersion]);
  const activeChat = useMemo(() => getActiveChat(), [chatVersion]);
  const selectedId = activeChat?.workflowId || '';
  const selected = workflows.find(w => w.id === selectedId) || null;

  // Ensure a default workflow is selected when none is set: pick the first
  useEffect(() => {
    try {
      if (!activeChat?.workflowId && workflows.length > 0) {
        setActiveChatWorkflow(workflows[0].id);
        setChatVersion(v => v + 1);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.workflowId, workflows.length]);

  const label = selected ? selected.name : (workflows[0]?.name || '');

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 text-gray-900"
        style={{ fontSize: 24, fontWeight: 700 }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select workflow"
      >
        <span>{label}</span>
        <ChevronDown size={20} className="text-gray-500" />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-[280px] bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-40">
          <div className="px-2 py-1 text-xs text-gray-500">Workflows</div>
          <ul role="listbox" className="max-h-80 overflow-y-auto">
            {workflows.map(w => {
              const isSel = w.id === selectedId;
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => { e.stopPropagation(); setActiveChatWorkflow(w.id); setOpen(false); setChatVersion(v => v + 1); }}
                    className={`w-full text-left px-3 py-2 rounded hover:bg-gray-50 ${isSel ? 'font-semibold' : ''}`}
                    role="option"
                    aria-selected={isSel}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-black">{w.name}</div>
                        <div className="text-xs text-gray-500">Workflow preset</div>
                      </div>
                      {isSel && <Check size={16} className="text-gray-800" />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default WorkflowSelector;
