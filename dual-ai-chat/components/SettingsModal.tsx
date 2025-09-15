import React, { useMemo, useState } from 'react';
import { DiscussionMode } from '../types';
import { X, Cog, PlugZap, Users, GitBranch, Sparkles } from 'lucide-react';
import PromptOptimizerCard from './settings/PromptOptimizerCard';
import ApiChannelsTab from './settings/ApiChannelsTab';
import PromptOptimizerCard from './settings/PromptOptimizerCard';
import { useAppStore } from '../store/appStore';
import { getRoleLibrary, setRoleLibrary, getWorkflowPresets, setWorkflowPresets, getActiveWorkflowId, setActiveWorkflowId } from '../utils/workflowStore';
import type { RoleLibraryItem } from '../types';
import RoleEditorModal from './RoleEditorModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRoleLibrary?: () => void;
  onOpenWorkflowEditor?: () => void;

  // Legacy props kept for compatibility (not used after refactor)
  discussionMode: DiscussionMode;
  onDiscussionModeChange: (mode: DiscussionMode) => void;
  manualFixedTurns: number;
  onManualFixedTurnsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  minManualFixedTurns: number;
  isThinkingBudgetActive: boolean;
  onThinkingBudgetToggle: () => void;
  supportsThinkingConfig: boolean;
  cognitoSystemPrompt: string;
  onCognitoPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onResetCognitoPrompt: () => void;
  museSystemPrompt: string;
  onMusePromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onResetMusePrompt: () => void;
  supportsSystemInstruction: boolean;

  isLoading: boolean;
  fontSizeScale: number;
  onFontSizeScaleChange: (scale: number) => void;
  // Debug toggle for workflow messages
  showWorkflowDebug: boolean;
  onWorkflowDebugToggle: () => void;

  // Theme selection
  theme: 'default' | 'claude' | 'dark';
  onThemeChange: (theme: 'default' | 'claude' | 'dark') => void;

  // Streaming preferences
  streamingEnabled: boolean;
  onStreamingEnabledToggle: () => void;
  streamIntervalMs: number;
  onStreamIntervalChange: (ms: number) => void;
  // Typing caret preference
  typingCaretEnabled: boolean;
  onTypingCaretToggle: () => void;

  // Legacy API config props (not used after refactor)
  useCustomApiConfig: boolean;
  onUseCustomApiConfigChange: () => void;
  customApiEndpoint: string;
  onCustomApiEndpointChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  customApiKey: string;
  onCustomApiKeyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  useOpenAiApiConfig: boolean;
  onUseOpenAiApiConfigChange: () => void;
  openAiApiBaseUrl: string;
  onOpenAiApiBaseUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  openAiApiKey: string;
  onOpenAiApiKeyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  openAiCognitoModelId: string;
  onOpenAiCognitoModelIdChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  openAiMuseModelId: string;
  onOpenAiMuseModelIdChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenRoleLibrary,
  onOpenWorkflowEditor,
  isLoading,
  fontSizeScale,
  onFontSizeScaleChange,
  showWorkflowDebug,
  onWorkflowDebugToggle,
  theme,
  onThemeChange,
  streamingEnabled,
  onStreamingEnabledToggle,
  streamIntervalMs,
  onStreamIntervalChange,
  typingCaretEnabled,
  onTypingCaretToggle,
  // swallows the rest for compatibility
  ..._rest
}) => {
  const [active, setActive] = useState<'general' | 'api' | 'roles' | 'orchestra'>('general');
  const { state } = useAppStore();
  const [roles, setRoles] = useState<RoleLibraryItem[]>(() => getRoleLibrary());
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleLibraryItem | undefined>(undefined);
  const [workflows, setWorkflows] = useState(() => getWorkflowPresets());
  const [editingWfId, setEditingWfId] = useState<string | null>(null);
  if (!isOpen) return null;

  const FONT_SIZE_PRESETS: Record<string, number> = {
    small: 0.875,
    mid: 1.0,
    large: 1.125,
    'large+': 1.25,
  };
  const currentFontPreset = useMemo(() => {
    const entries = Object.entries(FONT_SIZE_PRESETS);
    let best: string = 'mid';
    let bestDiff = Infinity;
    for (const [k, v] of entries) {
      const d = Math.abs((fontSizeScale || 1) - v);
      if (d < bestDiff) { best = k; bestDiff = d; }
    }
    return best as keyof typeof FONT_SIZE_PRESETS;
  }, [fontSizeScale]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-white w-[min(980px,95vw)] max-h-[90vh] min-h-[600px] rounded-2xl shadow-2xl overflow-hidden border border-gray-200 flex">
        {/* Left navigation */}
        <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="px-3 pt-3 pb-2">
            <button onClick={onClose} className="text-gray-600 hover:text-gray-800" aria-label="Close settings">
              <X size={18} />
            </button>
          </div>
          <nav className="px-2 pb-3 space-y-1 flex-1 overflow-y-auto">
            {[
              { key: 'general', label: 'General', icon: <Cog size={16} className="mr-2" /> },
              { key: 'api', label: 'API', icon: <PlugZap size={16} className="mr-2" /> },
              { key: 'roles', label: 'Roles', icon: <Users size={16} className="mr-2" /> },
              { key: 'orchestra', label: 'Orchestra', icon: <GitBranch size={16} className="mr-2" /> },
              { key: 'optimizer', label: 'Prompt optimizer', icon: <Sparkles size={16} className="mr-2" /> },
            ].map((it: any) => (
              <button
                key={it.key}
                className={`w-full flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${active===it.key ? 'bg-gray-200 text-black' : 'text-black hover:bg-gray-100'}`}
                onClick={() => setActive(it.key)}
              >
                {it.icon}
                <span>{it.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Right content */}
        <section className="flex-1 flex flex-col bg-white">
          <div className="px-6 h-12 flex items-center text-xl font-semibold text-black">
            {active==='general' ? 'General' : active==='api' ? 'API' : active==='roles' ? 'Roles' : active==='orchestra' ? 'Orchestra' : active==='optimizer' ? 'Prompt optimizer' : ''}
          </div>
          <div className="h-px bg-gray-200 mx-6" />
          <div className="flex-1 overflow-y-auto settings-modal-content-scrollbar px-6 py-3 pb-10">
            {active === 'general' && (
              <div className="divide-y divide-gray-200">
                <div className="flex items-center justify-between h-12">
                  <div className="text-base font-medium text-gray-900">Font Size</div>
                  <div className="relative">
                    <select
                      className="appearance-none bg-white text-black text-sm font-semibold pr-3 pl-1 py-1 rounded focus:outline-none focus:ring-0 border-0 hover:bg-gray-50"
                      value={currentFontPreset}
                      onChange={(e)=> onFontSizeScaleChange(FONT_SIZE_PRESETS[e.target.value])}
                    >
                      <option value="small">Small</option>
                      <option value="mid">Mid</option>
                      <option value="large">Large</option>
                      <option value="large+">Large+</option>
                    </select>
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-black">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between h-12">
                  <div className="text-base font-medium text-gray-900">Theme</div>
                  <div className="relative">
                    <select
                      className="appearance-none bg-white text-black text-sm font-semibold pr-3 pl-1 py-1 rounded focus:outline-none focus:ring-0 border-0 hover:bg-gray-50"
                      value={theme}
                      onChange={(e)=> onThemeChange(e.target.value as 'default'|'claude'|'dark')}
                    >
                      <option value="default">Default</option>
                      <option value="claude">Claude Style</option>
                      <option value="dark">Dark Mode</option>
                    </select>
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-black">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between h-12">
                  <div className="text-base font-medium text-gray-900">Streaming Interval (ms)</div>
                  <div className="relative">
                    <select
                      className="appearance-none bg-white text-black text-sm font-semibold pr-3 pl-1 py-1 rounded focus:outline-none focus:ring-0 border-0 hover:bg-gray-50 disabled:opacity-50"
                      value={String(streamIntervalMs)}
                      onChange={(e)=> onStreamIntervalChange(parseInt(e.target.value, 10))}
                    >
                      {[16, 30, 50, 60, 80, 100].map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-black">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between h-12">
                  <div className="text-base font-medium text-gray-900">Show Typing Caret</div>
                  <button
                    onClick={onTypingCaretToggle}
                    aria-label={typingCaretEnabled ? 'Disable typing caret' : 'Enable typing caret'}
                    className={`w-10 h-6 rounded-full transition-colors ${typingCaretEnabled ? 'bg-black' : 'bg-gray-300'}`}
                  >
                    <span className={`block w-5 h-5 bg-white rounded-full transform transition-transform ${typingCaretEnabled ? 'translate-x-4' : 'translate-x-1'}`}></span>
                  </button>
                </div>
                <div className="flex items-center justify-between h-12">
                  <div className="text-base font-medium text-gray-900">Enable Workflow Debug</div>
                  <button
                    onClick={onWorkflowDebugToggle}
                    aria-label={showWorkflowDebug ? 'Disable workflow debug' : 'Enable workflow debug'}
                    className={`w-10 h-6 rounded-full transition-colors ${showWorkflowDebug ? 'bg-black' : 'bg-gray-300'}`}
                  >
                    <span className={`block w-5 h-5 bg-white rounded-full transform transition-transform ${showWorkflowDebug ? 'translate-x-4' : 'translate-x-1'}`}></span>
                  </button>
                </div>
              </div>
            )}
            {active === 'optimizer' && (
              <div className="space-y-3">
                <PromptOptimizerCard />
              </div>
            )}
            {active === 'api' && (
              <ApiChannelsTab />
            )}
            {active === 'roles' && (
              <div className="space-y-3">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => { setEditingRole(undefined); setRoleEditorOpen(true); }}
                    className="inline-flex items-center text-gray-700 hover:text-black p-1"
                    aria-label="Add role"
                    title="Add role"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  </button>
                </div>
                <div className="h-px bg-gray-200 my-2" aria-hidden="true"></div>
                <ul className="divide-y divide-gray-200">
                  {roles.map(r => (
                    <li key={r.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2 px-1">
                        <div className="font-medium text-gray-900 text-base inline-flex items-center">
                          <span>{r.name}</span>
                          <button
                            type="button"
                            onClick={() => { const next = roles.filter(x => x.id !== r.id); setRoles(next); setRoleLibrary(next); }}
                            title="Delete role"
                            aria-label="Delete role"
                            className="ml-2 text-gray-400 hover:text-red-600 focus:outline-none"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                        <div className="text-xs text-gray-500">{state.apiProviders.find(p=>p.id===r.providerId)?.providerType || ''}</div>
                      </div>
                      <div className="pr-1">
                        <button
                          type="button"
                          className="px-3 py-1 rounded-full border border-gray-300 text-black font-semibold text-sm bg-white hover:bg-gray-50"
                          onClick={() => { setEditingRole(r); setRoleEditorOpen(true); }}
                        >
                          Manage
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {active === 'orchestra' && (
              <div className="space-y-3">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      // create NameN unique
                      const base = 'Name';
                      let n = 1;
                      const names = new Set(workflows.map((w:any)=>w.name));
                      while (names.has(`${base}${n}`)) n++;
                      const id = 'wf-' + Date.now().toString();
                      const next = [...workflows, { id, name: `${base}${n}`, isActive: false, rounds: [] }];
                      setWorkflows(next); setWorkflowPresets(next);
                      setEditingWfId(id);
                    }}
                    className="inline-flex items-center text-gray-700 hover:text-black p-1"
                    aria-label="Add workflow"
                    title="Add workflow"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  </button>
                </div>
                <div className="h-px bg-gray-200 my-2" aria-hidden="true"></div>
                <ul className="divide-y divide-gray-200">
                  {workflows.map((wf:any) => (
                    <li key={wf.id} className="flex items-center justify-between py-3">
                      <div className="flex flex-col gap-1 px-1">
                        <div className="flex items-center gap-2">
                          {editingWfId === wf.id ? (
                            <input
                              autoFocus
                              defaultValue={wf.name}
                              onBlur={(e)=>{
                                const v = e.target.value.trim() || wf.name;
                                const next = workflows.map((w:any)=> w.id===wf.id ? { ...w, name: v } : w);
                                setWorkflows(next); setWorkflowPresets(next); setEditingWfId(null);
                              }}
                              onKeyDown={(e)=>{ if (e.key==='Enter' || e.key==='Escape') (e.target as HTMLInputElement).blur(); }}
                              className="px-1 py-0.5 border border-gray-300 rounded text-base text-gray-900"
                            />
                          ) : (
                            <div className="font-medium text-gray-900 text-base inline-flex items-center">
                              <button onClick={()=>setEditingWfId(wf.id)} className="hover:underline">{wf.name}</button>
                              <button
                                type="button"
                                onClick={() => { const next = workflows.filter((x:any)=>x.id!==wf.id); setWorkflows(next); setWorkflowPresets(next); if (getActiveWorkflowId()===wf.id) setActiveWorkflowId(''); }}
                                title="Delete workflow"
                                aria-label="Delete workflow"
                                className="ml-2 text-gray-400 hover:text-red-600 focus:outline-none"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                              </button>
                            </div>
                          )}
                        </div>
                        <div>
                          {/* Toggle */}
                          <button
                            onClick={()=>{
                              const next = workflows.map((w:any)=> ({...w, isActive: w.id===wf.id ? !w.isActive : false }));
                              // ensure only one active
                              const active = next.find((w:any)=>w.isActive);
                              setWorkflows(next); setWorkflowPresets(next); setActiveWorkflowId(active? active.id : '');
                            }}
                            aria-label={wf.isActive? 'Deactivate workflow' : 'Activate workflow'}
                            className={`w-10 h-6 rounded-full transition-colors ${wf.isActive? 'bg-black' : 'bg-gray-300'}`}
                          >
                            <span className={`block w-5 h-5 bg-white rounded-full transform transition-transform ${wf.isActive? 'translate-x-4' : 'translate-x-1'}`}></span>
                          </button>
                        </div>
                      </div>
                      <div className="pr-1">
                        <button
                          type="button"
                          className="px-3 py-1 rounded-full border border-gray-300 text-black font-semibold text-sm bg-white hover:bg-gray-50"
                          onClick={() => { setActiveWorkflowId(wf.id); onOpenWorkflowEditor && onOpenWorkflowEditor(); }}
                        >
                          Manage
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </div>
      {roleEditorOpen && (
        <RoleEditorModal
          isOpen={roleEditorOpen}
          initial={editingRole}
          providers={state.apiProviders}
          onCancel={() => setRoleEditorOpen(false)}
          onSave={(item) => { const exists = roles.some(x=>x.id===item.id); const next = exists ? roles.map(x=>x.id===item.id?item:x) : [...roles, item]; setRoles(next); setRoleLibrary(next); setRoleEditorOpen(false); }}
        />
      )}
    </div>
  );
};

export default SettingsModal;
