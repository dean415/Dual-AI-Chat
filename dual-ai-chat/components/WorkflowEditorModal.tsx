import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Pencil } from 'lucide-react';
import type { WorkflowPresetMinimal, WorkflowRound, WorkflowRoundPerRoleOptions, RoleLibraryItem, ApiProviderConfig, RoleConfig } from '../types';
import { getWorkflowPresets, setWorkflowPresets, getActiveWorkflowId, getRoleLibrary, setRoleLibrary } from '../utils/workflowStore';
import RoleConfigEditor from './RoleConfigEditor';
import { useAppStore } from '../store/appStore';

interface Props { isOpen: boolean; onClose: () => void; }

const historyOptions = [
  { label: 'Disabled', value: 0 },
  { label: '2', value: 2 },
  { label: '4', value: 4 },
  { label: '6', value: 6 },
  { label: '8', value: 8 },
];

const WorkflowEditorModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { state } = useAppStore();
  const providers = (state.apiProviders || []) as ApiProviderConfig[];
  const [preset, setPreset] = useState<WorkflowPresetMinimal | null>(null);
  const [roundIndex, setRoundIndex] = useState<number>(0);
  const [roleLibrary, setRoleLibraryLocal] = useState<RoleLibraryItem[]>([]);
  const [editing, setEditing] = useState<RoleLibraryItem | null>(null);
  const [draft, setDraft] = useState<RoleConfig | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const presets = getWorkflowPresets();
    const activeId = getActiveWorkflowId();
    const byId = activeId ? presets.find(p => p.id === activeId) : null;
    const current = byId || presets[0] || null;
    if (current) {
      setPreset(current);
    } else {
      const id = `wf-${Date.now()}`;
      const empty: WorkflowPresetMinimal = {
        id,
        name: 'Workflow 1',
        rounds: [
          { roles: [], perRole: {} },
          { roles: [], perRole: {} },
          { roles: [], perRole: {} },
        ],
      } as WorkflowPresetMinimal;
      setWorkflowPresets([empty]);
      setPreset(empty);
    }
    setRoleLibraryLocal(getRoleLibrary());
  }, [isOpen]);

  const savePreset = (next: WorkflowPresetMinimal) => {
    setPreset(next);
    const list = getWorkflowPresets();
    const exists = list.some(p => p.id === next.id);
    const updated = exists ? list.map(p => (p.id === next.id ? next : p)) : [...list, next];
    setWorkflowPresets(updated);
  };

  const addRound = () => {
    if (!preset) return;
    const rounds = [...preset.rounds, { roles: [], perRole: {} } as WorkflowRound];
    savePreset({ ...preset, rounds });
    setRoundIndex(rounds.length - 1);
  };

  const updateRoundRoles = (idx: number, value: string) => {
    if (!preset) return;
    const raw = value.split(',').map(s => s.trim()).filter(Boolean);
    const roles = raw.slice(0, 4);
    const rounds = preset.rounds.map((r, i) => (i === idx ? { ...r, roles } : r));
    const pr = { ...(rounds[idx].perRole || {}) } as Record<string, WorkflowRoundPerRoleOptions>;
    for (const name of roles) if (!pr[name]) pr[name] = { historyN: 0, receiveFrom: [] };
    rounds[idx] = { ...rounds[idx], perRole: pr };
    savePreset({ ...preset, rounds });
  };

  const roleNamesBeforeCurrent = useMemo(() => {
    if (!preset) return [] as string[];
    const names: string[] = [];
    for (let i = 0; i < Math.min(roundIndex, preset.rounds.length); i++) names.push(...(preset.rounds[i].roles || []));
    return Array.from(new Set(names));
  }, [preset, roundIndex]);

  const updateHistoryN = (roleName: string, n: number) => {
    if (!preset) return;
    const rounds = [...preset.rounds];
    const r = { ...(rounds[roundIndex] || { roles: [], perRole: {} }) } as WorkflowRound;
    const perRole = { ...(r.perRole || {}) } as Record<string, WorkflowRoundPerRoleOptions>;
    const cur = perRole[roleName] || { historyN: 0, receiveFrom: [] };
    perRole[roleName] = { ...cur, historyN: n as any };
    rounds[roundIndex] = { ...r, perRole };
    savePreset({ ...preset, rounds });
  };

  const toggleReceiveFrom = (roleName: string, fromName: string) => {
    if (!preset) return;
    const rounds = [...preset.rounds];
    const r = { ...(rounds[roundIndex] || { roles: [], perRole: {} }) } as WorkflowRound;
    const perRole = { ...(r.perRole || {}) } as Record<string, WorkflowRoundPerRoleOptions>;
    const cur = perRole[roleName] || { historyN: 0, receiveFrom: [] };
    const list = new Set(cur.receiveFrom || []);
    if (list.has(fromName)) list.delete(fromName); else list.add(fromName);
    perRole[roleName] = { ...cur, receiveFrom: Array.from(list) };
    rounds[roundIndex] = { ...r, perRole };
    savePreset({ ...preset, rounds });
  };

  if (!isOpen || !preset) return null;

  const currentRound = preset.rounds[roundIndex] || { roles: [], perRole: {} };
  const roleNamesLib = roleLibrary.map(r => r.name);
  const RoleSelect: React.FC<{ value: string; options: string[]; onChange: (v: string) => void; }> = ({ value, options, onChange }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const btnRef = React.useRef<HTMLButtonElement | null>(null);
    const popRef = React.useRef<HTMLDivElement | null>(null);
    useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        if (!open) return;
        const t = e.target as Node;
        if (btnRef.current && btnRef.current.contains(t)) return;
        if (popRef.current && popRef.current.contains(t)) return;
        setOpen(false); setQuery('');
      };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);
    const filtered = useMemo(() => {
      const q = query.toLowerCase();
      return q ? options.filter(o => o.toLowerCase().includes(q)) : options;
    }, [options, query]);
    return (
      <div className="relative inline-flex items-center">
        <button ref={btnRef} type="button" className="appearance-none bg-white text-black text-sm font-semibold pl-1 pr-[6px] py-1 focus:outline-none hover:bg-gray-50 rounded inline-flex items-center" onClick={() => setOpen(o=>!o)}>
          <span>{value || 'Select Role'}</span>
          <span className="ml-[1px] text-black"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
        </button>
        <button
          type="button"
          className="ml-1 text-gray-500 hover:text-black"
          aria-label="Edit role"
          onClick={() => {
            if (!value) return;
            const item = roleLibrary.find(r => r.name === value) || null;
            if (item) {
              setEditing(item);
              setDraft({
                roleId: item.id,
                displayName: item.name,
                providerId: item.providerId,
                modelId: item.modelId,
                systemPrompt: item.systemPrompt,
                userPromptTemplate: undefined,
                parameters: item.parameters,
              });
            }
          }}
          disabled={!value}
          title={!value ? '请选择角色后再编辑' : `编辑 ${value}`}
        >
          <Pencil size={14} />
        </button>
        {open && (
          <div ref={popRef} className="absolute left-0 top-full z-50 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl p-1">
            <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Type to filter..." className="w-full px-2 py-1 mb-1 text-sm border border-gray-200 rounded focus:outline-none" />
            <div className="max-h-56 overflow-y-auto">
              {filtered.map(opt => (
                <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false); setQuery(''); }} className={`w-full text-left px-3 py-2 rounded flex items-center justify-between hover:bg-gray-100 ${opt===value ? 'bg-gray-100' : ''}`}>
                  <span className="text-sm text-gray-900">{opt}</span>
                  {opt===value && (<span className="text-black"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>)}
                </button>
              ))}
              {filtered.length===0 && (<div className="px-3 py-2 text-sm text-gray-500">No results</div>)}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Inline role editor view
  if (editing && draft) {
    const saveDraft = () => {
      const updated: RoleLibraryItem = {
        id: draft.roleId,
        name: draft.displayName,
        providerId: draft.providerId,
        modelId: draft.modelId,
        systemPrompt: draft.systemPrompt,
        parameters: draft.parameters,
      };
      const next = roleLibrary.map(r => (r.id === updated.id ? updated : r));
      setRoleLibraryLocal(next);
      setRoleLibrary(next);
      setEditing(null);
      setDraft(null);
    };
    const cancelEdit = () => { setEditing(null); setDraft(null); };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white w-[min(760px,95vw)] max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col">
          <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="text-base font-semibold text-black">Role</div>
            <button onClick={cancelEdit} className="text-gray-600 hover:text-gray-800" aria-label="Close role editor">
              <X size={18} />
            </button>
          </div>
          <div className="p-4 overflow-y-auto">
            <RoleConfigEditor title="" role={draft} providers={providers} hideUserPromptTemplate onChange={setDraft as any} />
          </div>
          <div className="px-4 py-2 border-t border-gray-200 bg-white flex justify-end gap-2">
            <button onClick={cancelEdit} className="px-3 py-1.5 border rounded text-sm text-black hover:bg-gray-100">Cancel</button>
            <button onClick={saveDraft} className="px-3 py-1.5 rounded bg-black text-white text-sm hover:bg-gray-800">Save</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white w-[min(1100px,95vw)] max-h-[90vh] min-h-[600px] rounded-2xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col">
        {/* Header */}
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="text-base font-semibold text-black">Orchestra</div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left: rounds */}
          <aside className="w-64 border-r bg-gray-50 flex-shrink-0 flex flex-col">
            <div className="p-2 space-y-2 flex-1 overflow-y-auto">
              <div className="text-xs text-gray-600">Rounds</div>
              <ul className="space-y-1">
                {preset.rounds.map((_, i) => (
                  <li key={`round-${i}`} className="flex items-center justify-between">
                    <button
                      className={`flex-1 text-left px-2 py-1 rounded ${i===roundIndex ? 'bg-gray-200 text-black' : 'hover:bg-gray-100 text-black'}`}
                      onClick={() => setRoundIndex(i)}
                    >Round {i+1}</button>
                    <button
                      className="ml-2 text-gray-400 hover:text-red-600"
                      aria-label="Delete round"
                      onClick={() => {
                        const rounds = preset.rounds.filter((_, idx) => idx !== i);
                        if (rounds.length === 0) return;
                        savePreset({ ...preset, rounds } as WorkflowPresetMinimal);
                        setRoundIndex(Math.max(0, Math.min(roundIndex, rounds.length - 1)));
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-2 border-t">
              <button onClick={addRound} className="w-full flex items-center justify-center gap-1 px-2 py-1 border rounded text-sm text-black hover:bg-gray-100">
                <Plus size={14} /> Add Round
              </button>
            </div>
          </aside>

          {/* Right: editor */}
          <section className="flex-1 p-3 overflow-y-auto pb-12">
            <div className="flex items-center justify-end mb-2">
              <button
                onClick={() => {
                  const roles = [...(currentRound.roles || []), ''];
                  const rounds = preset.rounds.map((r, i) => (i === roundIndex ? { ...r, roles } : r));
                  savePreset({ ...preset, rounds } as WorkflowPresetMinimal);
                }}
                className="px-3 py-1 rounded-full border border-gray-300 text-black font-semibold text-sm bg-white hover:bg-gray-50"
              >
                + Role
              </button>
            </div>
            <div className="h-px bg-gray-200 my-2" />

            <div className="mt-3">
              {(currentRound.roles || []).map((name, roleIdx) => {
                const per = (currentRound.perRole && (currentRound.perRole as any)[name]) || { historyN: 0, receiveFrom: [] } as WorkflowRoundPerRoleOptions;
                return (
                  <div key={`role-${roleIdx}-${name}`} className="py-2 border-t first:border-t-0 border-gray-200 flex items-center justify-between">
                    {/* Left: role select (custom) fixed width wrapper */}
                    <div className="shrink-0 w-[280px]">
                      <RoleSelect
                        value={name}
                        options={roleNamesLib}
                        onChange={(v) => {
                          const roles = (currentRound.roles || []).map((r, idx) => (idx === roleIdx ? v : r));
                          const rounds = preset.rounds.map((r, i) => (i === roundIndex ? { ...r, roles } : r));
                          savePreset({ ...preset, rounds } as WorkflowPresetMinimal);
                        }}
                      />
                    </div>
                    {/* Middle: history select fixed width wrapper (outer fixed, inner auto) */}
                    <div className="shrink-0 w-[240px]">
                      <div className="relative inline-block">
                        <select
                          className="appearance-none bg-white text-gray-900 text-sm font-semibold pr-7 pl-1 py-1 focus:outline-none focus:ring-0 border-0 hover:bg-gray-50"
                          value={per.historyN}
                          onChange={(e) => updateHistoryN(name, parseInt(e.target.value, 10))}
                        >
                          {historyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-black">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                      </div>
                    </div>
                    {/* Right: receive-from clickable list (no header, vertical) */}
                    <div className="text-sm flex-1 ml-6">
                      <div className="mt-1 flex flex-col gap-1">
                        {roleNamesBeforeCurrent.length === 0 ? (
                          <span className="text-xs text-gray-500">None</span>
                        ) : (
                          roleNamesBeforeCurrent.map(rn => {
                            const active = per.receiveFrom.includes(rn);
                            return (
                              <button
                                key={rn}
                                type="button"
                                onClick={() => toggleReceiveFrom(name, rn)}
                                className={`text-xs text-left hover:text-black ${active ? 'font-semibold text-black' : 'font-normal text-gray-700'}`}
                              >
                                {rn}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                    {/* Delete role button */}
                    <button
                      className="ml-2 text-gray-400 hover:text-red-600"
                      aria-label="Delete role"
                      onClick={() => {
                        const roles = (currentRound.roles || []).filter((_, idx) => idx !== roleIdx);
                        const rounds = preset.rounds.map((r, i) => {
                          if (i !== roundIndex) return r;
                          const pr = { ...(r.perRole || {}) } as Record<string, WorkflowRoundPerRoleOptions>;
                          if (name && pr[name]) delete pr[name];
                          return { ...r, roles, perRole: pr } as WorkflowRound;
                        });
                        savePreset({ ...preset, rounds } as WorkflowPresetMinimal);
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default WorkflowEditorModal;
