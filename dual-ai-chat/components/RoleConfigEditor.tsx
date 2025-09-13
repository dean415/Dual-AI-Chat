import React, { useMemo } from 'react';
import { ApiProviderConfig, RoleConfig } from '../types';

interface Props {
  title: string;
  role: RoleConfig;
  providers: ApiProviderConfig[];
  // Optional plain-text note for template variables, shown as {{var}} list
  availableVariablesText?: string;
  onChange: (role: RoleConfig) => void;
}

const RoleConfigEditor: React.FC<Props> = ({ title, role, providers, availableVariablesText, onChange }) => {
  const params = role.parameters || {};
  const setParams = (next: Partial<RoleConfig['parameters']>) => {
    const merged = { ...(role.parameters || {}), ...next };
    // Remove undefined keys to keep clean
    const clean: any = {};
    Object.entries(merged).forEach(([k, v]) => { if (v !== undefined) (clean as any)[k] = v; });
    onChange({ ...role, parameters: Object.keys(clean).length ? (clean as any) : undefined });
  };

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="font-semibold text-gray-700">{title}</div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">显示名
          <input className="mt-1 w-full border border-gray-300 rounded p-1.5" value={role.displayName} onChange={e => onChange({ ...role, displayName: e.target.value })} />
        </label>
        <label className="text-sm">渠道
          <select className="mt-1 w-full border border-gray-300 rounded p-1.5" value={role.providerId} onChange={e => onChange({ ...role, providerId: e.target.value })}>
            {providers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.providerType})</option>)}
          </select>
        </label>
        <label className="text-sm col-span-2">模型 ID
          <input className="mt-1 w-full border border-gray-300 rounded p-1.5" value={role.modelId} onChange={e => onChange({ ...role, modelId: e.target.value })} placeholder="例如 gemini-2.5-pro / gpt-4o / llama3" />
        </label>
        <label className="text-sm col-span-2">系统提示词
          <textarea className="mt-1 w-full border border-gray-300 rounded p-1.5 h-24" value={role.systemPrompt || ''} onChange={e => onChange({ ...role, systemPrompt: e.target.value })} />
        </label>
        <label className="text-sm col-span-2">User 模板
          <textarea className="mt-1 w-full border border-gray-300 rounded p-1.5 h-20" value={role.userPromptTemplate || ''} onChange={e => onChange({ ...role, userPromptTemplate: e.target.value })} />
        </label>
        {/* Four common parameters with toggles */}
        <div className="col-span-2 grid grid-cols-2 gap-3">
          <div className="text-sm border rounded p-2">
            <div className="flex items-center justify-between">
              <span>模型温度 (0–2)</span>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={params.temperature !== undefined} onChange={e => setParams({ temperature: e.target.checked ? (params.temperature ?? 1) : undefined })} /> 启用
              </label>
            </div>
            <input type="range" min={0} max={2} step={0.1} disabled={params.temperature === undefined} value={params.temperature ?? 1} onChange={e => setParams({ temperature: parseFloat(e.target.value) })} className="w-full mt-2" />
            <div className="text-xs text-gray-600 mt-1">当前: {params.temperature ?? '未启用'}</div>
          </div>
          <div className="text-sm border rounded p-2">
            <div className="flex items-center justify-between">
              <span>Top‑P (0–1)</span>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={params.top_p !== undefined} onChange={e => setParams({ top_p: e.target.checked ? (params.top_p ?? 1) : undefined })} /> 启用
              </label>
            </div>
            <input type="range" min={0} max={1} step={0.05} disabled={params.top_p === undefined} value={params.top_p ?? 1} onChange={e => setParams({ top_p: parseFloat(e.target.value) })} className="w-full mt-2" />
            <div className="text-xs text-gray-600 mt-1">当前: {params.top_p ?? '未启用'}</div>
          </div>
          <div className="text-sm border rounded p-2">
            <div className="flex items-center justify-between">
              <span>Reasoning_Effort</span>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={params.reasoning_effort !== undefined} onChange={e => setParams({ reasoning_effort: e.target.checked ? (params.reasoning_effort ?? 'medium') : undefined })} /> 启用
              </label>
            </div>
            <select disabled={params.reasoning_effort === undefined} className="mt-2 w-full border border-gray-300 rounded p-1.5" value={params.reasoning_effort ?? 'medium'} onChange={e => setParams({ reasoning_effort: e.target.value as any })}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
            <div className="text-xs text-gray-600 mt-1">OpenAI ChatGPT 独家参数</div>
          </div>
          <div className="text-sm border rounded p-2">
            <div className="flex items-center justify-between">
              <span>verbosity</span>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={params.verbosity !== undefined} onChange={e => setParams({ verbosity: e.target.checked ? (params.verbosity ?? 'medium') : undefined })} /> 启用
              </label>
            </div>
            <select disabled={params.verbosity === undefined} className="mt-2 w-full border border-gray-300 rounded p-1.5" value={params.verbosity ?? 'medium'} onChange={e => setParams({ verbosity: e.target.value as any })}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
            <div className="text-xs text-gray-600 mt-1">OpenAI ChatGPT 独家参数</div>
          </div>
        </div>
        {availableVariablesText && (
          <div className="col-span-2">
            <div className="text-xs text-gray-600 mb-1">可用模板变量</div>
            <pre className="text-xs bg-gray-50 border rounded p-2 overflow-auto">{availableVariablesText}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleConfigEditor;
