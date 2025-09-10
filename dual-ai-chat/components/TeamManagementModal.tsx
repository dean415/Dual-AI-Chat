import React, { useMemo, useState } from 'react';
import { X, Users, CheckCircle2, Plus } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { DiscussionMode, DiscussionTeamPreset, RoleConfig, MoeTeamPreset, TeamPreset } from '../types';
import RoleConfigEditor from './RoleConfigEditor';
import { COGNITO_SYSTEM_PROMPT_HEADER, DEFAULT_MANUAL_FIXED_TURNS, MUSE_SYSTEM_PROMPT_HEADER } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TeamManagementModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { state, setTeamPresets, setActiveTeam } = useAppStore();
  const teams = state.teamPresets;
  const [selectedId, setSelectedId] = useState<string>(state.activeTeamId);

  const selectedTeam = useMemo<TeamPreset | undefined>(() => teams.find(t => t.id === selectedId) || teams[0], [teams, selectedId]);

  if (!isOpen) return null;

  const updateDiscussionTeam = (partial: Partial<DiscussionTeamPreset>) => {
    if (!selectedTeam || selectedTeam.mode !== 'discussion') return;
    const updated: DiscussionTeamPreset = { ...(selectedTeam as DiscussionTeamPreset), ...partial };
    const next = state.teamPresets.map(t => (t.id === selectedTeam.id ? updated : t));
    setTeamPresets(next);
  };

  const updateMoeTeam = (partial: Partial<MoeTeamPreset>) => {
    if (!selectedTeam || selectedTeam.mode !== 'moe') return;
    const updated: MoeTeamPreset = { ...(selectedTeam as MoeTeamPreset), ...partial };
    const next = state.teamPresets.map(t => (t.id === selectedTeam.id ? updated : t));
    setTeamPresets(next);
  };

  const updateRole = (key: 'cognito' | 'muse', role: RoleConfig) => {
    updateDiscussionTeam({ [key]: role } as Partial<DiscussionTeamPreset>);
  };

  const updateMoeRole = (key: keyof Pick<MoeTeamPreset,'stage1A'|'stage1B'|'stage2C'|'stage2D'|'summarizer'>, role: RoleConfig) => {
    updateMoeTeam({ [key]: role } as Partial<MoeTeamPreset>);
  };

  const createDiscussionTeam = () => {
    const firstProvider = state.apiProviders[0];
    const pid = firstProvider ? firstProvider.id : '';
    const id = `team-${Date.now()}`;
    const newTeam: DiscussionTeamPreset = {
      id,
      name: 'Discussion 团队',
      mode: 'discussion',
      discussionMode: DiscussionMode.AiDriven,
      fixedTurns: DEFAULT_MANUAL_FIXED_TURNS,
      cognito: { roleId: 'cognito', displayName: 'Cognito', providerId: pid, modelId: firstProvider?.defaultModel || '', systemPrompt: COGNITO_SYSTEM_PROMPT_HEADER, userPromptTemplate: '{{user_prompt}}', parameters: {} },
      muse: { roleId: 'muse', displayName: 'Muse', providerId: pid, modelId: firstProvider?.defaultModel || '', systemPrompt: MUSE_SYSTEM_PROMPT_HEADER, userPromptTemplate: '{{user_prompt}}', parameters: {} },
    };
    setTeamPresets([...state.teamPresets, newTeam]);
    setSelectedId(id);
  };

  const createMoeTeam = () => {
    const firstProvider = state.apiProviders[0];
    const pid = firstProvider ? firstProvider.id : '';
    const id = `team-${Date.now()}`;
    const newTeam: MoeTeamPreset = {
      id,
      name: 'MoE 团队',
      mode: 'moe',
      stage1A: { roleId: 'stage1A', displayName: 'R1A', providerId: pid, modelId: firstProvider?.defaultModel || '', systemPrompt: '', userPromptTemplate: '{{user_prompt}}', parameters: {} },
      stage1B: { roleId: 'stage1B', displayName: 'R1B', providerId: pid, modelId: firstProvider?.defaultModel || '', systemPrompt: '', userPromptTemplate: '{{user_prompt}}', parameters: {} },
      stage2C: { roleId: 'stage2C', displayName: 'R2C', providerId: pid, modelId: firstProvider?.defaultModel || '', systemPrompt: '', userPromptTemplate: `用户请求：{{user_prompt}}
R1A 的答案：{{stage1_a_result}}`, parameters: {} },
      stage2D: { roleId: 'stage2D', displayName: 'R2D', providerId: pid, modelId: firstProvider?.defaultModel || '', systemPrompt: '', userPromptTemplate: `用户请求：{{user_prompt}}
R1B 的答案：{{stage1_b_result}}`, parameters: {} },
      summarizer: { roleId: 'summarizer', displayName: 'Summarizer', providerId: pid, modelId: firstProvider?.defaultModel || '', systemPrompt: COGNITO_SYSTEM_PROMPT_HEADER, userPromptTemplate: `用户请求：{{user_prompt}}
R1A：{{stage1_a_result}}
R1B：{{stage1_b_result}}
R2C：{{stage2_c_result}}
R2D：{{stage2_d_result}}`, parameters: {} },
    };
    setTeamPresets([...state.teamPresets, newTeam]);
    setSelectedId(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white w-[min(1100px,95vw)] max-h-[90vh] rounded-lg shadow-xl overflow-hidden border border-gray-300 flex">
        <div className="w-64 border-r bg-gray-50 flex-shrink-0 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-sky-600" />
              <span className="font-semibold">团队</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={(e)=>{e.preventDefault(); createDiscussionTeam();}} className="px-2 py-1 text-xs bg-sky-600 text-white rounded">新建 Discussion</button>
              <button type="button" onClick={(e)=>{e.preventDefault(); createMoeTeam();}} className="px-2 py-1 text-xs bg-purple-600 text-white rounded">新建 MoE</button>
            </div>
          </div>
          <div className="overflow-y-auto">
            {teams.map(t => (
              <button key={t.id} onClick={()=>setSelectedId(t.id)} className={`w-full text-left px-3 py-2 border-b hover:bg-gray-100 ${selectedId===t.id?'bg-gray-100':''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.mode === 'discussion' ? (t.discussionMode==='ai-driven'?'Discussion · AI驱动':'Discussion · 固定轮次') : 'MoE 模式'}</div>
                  </div>
                  {state.activeTeamId===t.id && <CheckCircle2 size={16} className="text-green-600"/>}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
            <div className="font-semibold">团队编辑</div>
            <div className="flex items-center gap-2">
              {selectedTeam && state.activeTeamId !== selectedTeam.id && (
                <button onClick={()=>setActiveTeam(selectedTeam.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-sm">设为激活</button>
              )}
              <button onClick={onClose} className="p-1 rounded hover:bg-gray-200" aria-label="关闭"><X size={18}/></button>
            </div>
          </div>
          <div className="p-4 overflow-y-auto">
            {selectedTeam ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">团队名称
                    <input className="mt-1 w-full border border-gray-300 rounded p-1.5" value={selectedTeam.name} onChange={e => {
                      if (selectedTeam.mode === 'discussion') updateDiscussionTeam({ name: e.target.value });
                      else updateMoeTeam({ name: e.target.value });
                    }} />
                  </label>
                  <label className="text-sm">模式
                    <select disabled className="mt-1 w-full border border-gray-300 rounded p-1.5" value={selectedTeam.mode}>
                      <option value={'discussion'}>Discussion</option>
                      <option value={'moe'}>MoE</option>
                    </select>
                  </label>
                  {selectedTeam.mode === 'discussion' && (
                    <div className="col-span-2 flex items-center gap-4">
                      <label className="text-sm inline-flex items-center gap-1">
                        <input type="radio" checked={(selectedTeam as DiscussionTeamPreset).discussionMode===DiscussionMode.AiDriven} onChange={()=>updateDiscussionTeam({ discussionMode: DiscussionMode.AiDriven })} /> AI 驱动
                      </label>
                      <label className="text-sm inline-flex items-center gap-1">
                        <input type="radio" checked={(selectedTeam as DiscussionTeamPreset).discussionMode===DiscussionMode.FixedTurns} onChange={()=>updateDiscussionTeam({ discussionMode: DiscussionMode.FixedTurns })} /> 固定轮次
                      </label>
                      {(selectedTeam as DiscussionTeamPreset).discussionMode===DiscussionMode.FixedTurns && (
                        <label className="text-sm inline-flex items-center gap-2">轮次
                          <input type="number" min={1} className="w-24 border border-gray-300 rounded p-1.5" value={(selectedTeam as DiscussionTeamPreset).fixedTurns || 1} onChange={e => updateDiscussionTeam({ fixedTurns: Math.max(1, parseInt(e.target.value,10)||1) })} />
                        </label>
                      )}
                    </div>
                  )}
                </div>
                {selectedTeam.mode === 'discussion' ? (
                  <>
                    <RoleConfigEditor title="Cognito 角色" role={(selectedTeam as DiscussionTeamPreset).cognito} providers={state.apiProviders} availableVariables={{ user_prompt: '' }} onChange={r => updateRole('cognito', r)} />
                    <RoleConfigEditor title="Muse 角色" role={(selectedTeam as DiscussionTeamPreset).muse} providers={state.apiProviders} availableVariables={{ user_prompt: '' }} onChange={r => updateRole('muse', r)} />
                  </>
                ) : (
                  <>
                    <RoleConfigEditor title="R1A 角色" role={(selectedTeam as MoeTeamPreset).stage1A} providers={state.apiProviders} availableVariables={{ user_prompt: '' }} onChange={r => updateMoeRole('stage1A', r)} />
                    <RoleConfigEditor title="R1B 角色" role={(selectedTeam as MoeTeamPreset).stage1B} providers={state.apiProviders} availableVariables={{ user_prompt: '' }} onChange={r => updateMoeRole('stage1B', r)} />
                    <RoleConfigEditor title="R2C 角色（评 R1A）" role={(selectedTeam as MoeTeamPreset).stage2C} providers={state.apiProviders} availableVariables={{ user_prompt: '', stage1_a_result: '' }} onChange={r => updateMoeRole('stage2C', r)} />
                    <RoleConfigEditor title="R2D 角色（评 R1B）" role={(selectedTeam as MoeTeamPreset).stage2D} providers={state.apiProviders} availableVariables={{ user_prompt: '', stage1_b_result: '' }} onChange={r => updateMoeRole('stage2D', r)} />
                    <RoleConfigEditor title="Summarizer 角色" role={(selectedTeam as MoeTeamPreset).summarizer} providers={state.apiProviders} availableVariables={{ user_prompt: '', stage1_a_result: '', stage1_b_result: '', stage2_c_result: '', stage2_d_result: '' }} onChange={r => updateMoeRole('summarizer', r)} />
                  </>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-600">请选择左侧的团队进行编辑</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamManagementModal;
