import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Plus, PlugZap } from 'lucide-react';
import ApiChannelForm from '../ApiChannelForm';
import type { ApiProviderConfig, TeamPreset } from '../../types';

const ApiChannelsTab: React.FC = () => {
  const { state, setProviders, setTeamPresets } = useAppStore();
  const providers = state.apiProviders || [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApiProviderConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usedByMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const t of state.teamPresets) {
      if (t.mode === 'discussion') {
        const ids = [t.cognito.providerId, t.muse.providerId];
        ids.forEach(id => { if (!map[id]) map[id] = []; map[id].push(t.name); });
      } else {
        const ids = [t.stage1A.providerId, t.stage1B.providerId, t.stage2C.providerId, t.stage2D.providerId, t.summarizer.providerId];
        ids.forEach(id => { if (!map[id]) map[id] = []; map[id].push(t.name); });
      }
    }
    return map;
  }, [state.teamPresets]);

  const openCreate = () => { setEditing(null); setDialogOpen(true); setError(null); };
  const openEdit = (id: string) => {
    const p = providers.find(x => x.id === id) || null;
    setEditing(p);
    setDialogOpen(true);
    setError(null);
  };

  const onSave = (cfg: ApiProviderConfig) => {
    setError(null);
    // Upsert by id
    const exists = providers.some(p => p.id === cfg.id);
    const next = exists ? providers.map(p => (p.id === cfg.id ? cfg : p)) : [...providers, cfg];
    setProviders(next);
    setDialogOpen(false);
  };

  const onDelete = (id: string) => {
    setError(null);
    const used = usedByMap[id];
    if (used && used.length) {
      setError(`无法删除：该渠道正被以下团队引用：${[...new Set(used)].join(', ')}。请在“团队管理”中替换后再试。`);
      return;
    }
    if (!window.confirm('确认删除该渠道？此操作不可撤销。')) return;
    setProviders(providers.filter(p => p.id !== id));
  };

  return (
    <section className="space-y-3" aria-labelledby="api-channels-heading">
      <h3 id="api-channels-heading" className="text-lg font-medium text-gray-800 border-b pb-2">API 渠道管理</h3>
      {error && <div className="p-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>}
      {providers.length === 0 ? (
        <div className="border-2 border-dashed rounded-md p-10 text-center text-gray-600">
          <div className="flex flex-col items-center gap-2">
            <PlugZap className="text-sky-600" />
            <div className="text-base">暂无 API 渠道</div>
            <div className="text-sm text-gray-500">添加您的第一个 API 渠道开始使用</div>
            <button
              type="button"
              onClick={openCreate}
              className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-sky-600 text-white rounded hover:bg-sky-700"
            >
              <Plus size={16} /> 新增渠道
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-600 text-white rounded hover:bg-sky-700"
              aria-label="新增渠道"
            >
              <Plus size={16} /> 新增渠道
            </button>
          </div>
          <ul className="divide-y border rounded">
            {providers.map(p => (
              <li key={p.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium text-gray-800">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.providerType}</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="px-2 py-1 text-sm border rounded" onClick={() => openEdit(p.id)}>编辑</button>
                  <button type="button" className="px-2 py-1 text-sm border rounded" onClick={() => onDelete(p.id)}>删除</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white w-[min(700px,95vw)] rounded shadow-lg p-4 border">
            <div className="text-lg font-semibold mb-2">{editing ? '编辑渠道' : '新增渠道'}</div>
            <ApiChannelForm initial={editing || undefined} onCancel={() => setDialogOpen(false)} onSave={onSave} />
          </div>
        </div>
      )}
    </section>
  );
};

export default ApiChannelsTab;
