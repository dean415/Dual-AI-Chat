import React, { useEffect, useMemo, useState } from 'react';
import { getRoleLibrary, subscribeWorkflowStore } from '../../utils/workflowStore';
import {
  getOptimizerEnabled,
  getOptimizerN,
  getOptimizerRoleName,
  getOptimizerTemplate,
  setOptimizerEnabled,
  setOptimizerN,
  setOptimizerRoleName,
  setOptimizerTemplate,
} from '../../utils/promptOptimizerStore';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const PromptOptimizerCard: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(() => getOptimizerEnabled());
  const [roleName, setRole] = useState<string>(() => getOptimizerRoleName());
  const [n, setN] = useState<number>(() => getOptimizerN());
  const [template, setTemplate] = useState<string>(() => getOptimizerTemplate());
  const [libVersion, setLibVersion] = useState<number>(0);

  useEffect(() => {
    const unsub = subscribeWorkflowStore(() => setLibVersion(v => v + 1));
    return () => { try { unsub(); } catch {} };
  }, []);

  const roleNames = useMemo(() => {
    try { return getRoleLibrary().map(r => r.name); } catch { return []; }
  }, [libVersion]);

  useEffect(() => { setOptimizerEnabled(enabled); }, [enabled]);
  useEffect(() => { setOptimizerRoleName(roleName); }, [roleName]);
  useEffect(() => { setOptimizerN(n); }, [n]);
  useEffect(() => { setOptimizerTemplate(template); }, [template]);

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="text-base font-semibold text-gray-900">Prompt Optimizer</div>
        <button
          onClick={() => setEnabled(v => !v)}
          aria-label={enabled ? 'Disable Prompt Optimizer' : 'Enable Prompt Optimizer'}
          className={`w-10 h-6 rounded-full transition-colors ${enabled ? 'bg-black' : 'bg-gray-300'}`}
        >
          <span className={`block w-5 h-5 bg-white rounded-full transform transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`}></span>
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-700">承载角色（Roles 列表）</label>
          <div className="relative">
            <select
              className="appearance-none bg-white text-black text-sm font-semibold pr-6 pl-2 py-1 rounded focus:outline-none focus:ring-0 border border-gray-300 hover:bg-gray-50 min-w-[180px]"
              value={roleName}
              onChange={(e) => setRole(e.target.value)}
              disabled={!enabled}
            >
              <option value="">未选择</option>
              {roleNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-black">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-700">最近 N 条消息</label>
          <input
            type="number"
            min={1}
            max={50}
            value={n}
            onChange={(e) => {
              const v = clamp(parseInt(e.target.value || '6', 10) || 6, 1, 50);
              setN(v);
            }}
            disabled={!enabled}
            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-700">用户提示词模板</label>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            disabled={!enabled}
            rows={5}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white resize-y"
          />
        </div>

        <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-2">
          可用占位符：
          <div><code className="text-gray-700">{'{{recent_mixed_messages}}'}</code> 最近 N 条历史（用户与 notepad/canvas 混合，已加来源前缀）。</div>
          <div><code className="text-gray-700">{'{{current_input}}'}</code> 当前输入框待优化的整段文本。</div>
          <div className="mt-1">注意：{'{workflow_name}'} 将被实际工作流名称替换后再传给模型。</div>
          <div className="mt-1 text-gray-600">
            发送策略：当所选渠道为 OpenAI 兼容时，最近 N 条历史会被拆分为多条 <code className="text-gray-700">role:'user'</code> 消息（用户消息以 <code>User's Original Request:</code> 开头，notepad 以 <code>{'{workflow_name}'}'s response to user:</code> 开头）；模板中的 <code className="text-gray-700">{'{{current_input}}'}</code> 将作为最后一条 <code>role:'user'</code> 消息单独发送。非 OpenAI 渠道则继续以拼接文本注入 <code className="text-gray-700">{'{{recent_mixed_messages}}'}</code> 后发送。
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptOptimizerCard;
