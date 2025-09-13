import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import RoleConfigEditor from './RoleConfigEditor';
import type { RoleLibraryItem, RoleConfig, ApiProviderConfig } from '../types';
import { getRoleLibrary, setRoleLibrary } from '../utils/workflowStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedName?: string;
}

const RoleLibraryModal: React.FC<Props> = ({ isOpen, onClose, initialSelectedName }) => {
  const { state } = useAppStore();
  const providers = state.apiProviders as ApiProviderConfig[];
  const [roles, setRoles] = useState<RoleLibraryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cur = getRoleLibrary();
      setRoles(cur);
      if (initialSelectedName) {
        const match = cur.find(r => r.name === initialSelectedName);
        setSelectedId(match ? match.id : (cur[0]?.id || null));
      } else {
        setSelectedId(cur[0]?.id || null);
      }
    }
  }, [isOpen, initialSelectedName]);

  if (!isOpen) return null;

  const selected = useMemo(() => roles.find(r => r.id === selectedId) || null, [roles, selectedId]);

  const toRoleConfig = (r: RoleLibraryItem): RoleConfig => ({
    roleId: r.id,
    displayName: r.name,
    providerId: r.providerId,
    modelId: r.modelId,
    systemPrompt: r.systemPrompt,
    userPromptTemplate: undefined,
    parameters: r.parameters,
  });
  const fromRoleConfig = (rc: RoleConfig): RoleLibraryItem => ({
    id: rc.roleId,
    name: rc.displayName,
    providerId: rc.providerId,
    modelId: rc.modelId,
    systemPrompt: rc.systemPrompt,
    parameters: rc.parameters,
  });

  const saveRoles = (list: RoleLibraryItem[]) => {
    setRoles(list);
    setRoleLibrary(list);
  };

  const addRole = () => {
    const id = `role-${Date.now()}`;
    const pid = providers[0]?.id || '';
    const newRole: RoleLibraryItem = { id, name: `Role ${roles.length + 1}`, providerId: pid, modelId: providers[0]?.defaultModel || '', systemPrompt: '', parameters: {} };
    const next = [...roles, newRole];
    saveRoles(next);
    setSelectedId(id);
  };

  const updateSelected = (rc: RoleConfig) => {
    const updated = fromRoleConfig(rc);
    const next = roles.map(r => (r.id === updated.id ? updated : r));
    saveRoles(next);
  };

  const deleteSelected = () => {
    if (!selected) return;
    if (!window.confirm('确认删除该角色？此操作不可撤销。')) return;
    const next = roles.filter(r => r.id !== selected.id);
    saveRoles(next);
    setSelectedId(next[0]?.id || null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white w-[min(1000px,95vw)] max-h-[90vh] rounded-lg shadow-xl overflow-hidden border border-gray-300 flex">
        <div className="w-60 border-r bg-gray-50 flex-shrink-0 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="font-semibold text-gray-800">角色库</div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="关闭">
              <X size={18} />
            </button>
          </div>
          <div className="p-2 flex-1 overflow-y-auto">
            <ul className="space-y-1">
              {roles.map(r => (
                <li key={r.id}>
                  <button
                    className={`w-full text-left px-2 py-1 rounded ${selectedId===r.id ? 'bg-black text-white' : 'hover:bg-gray-200 text-black'}`}
                    onClick={() => setSelectedId(r.id)}
                  >{r.name}</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-2 border-t">
            <button onClick={addRole} className="w-full flex items-center justify-center gap-1 px-2 py-1 border rounded text-sm text-black hover:bg-gray-100">
              <Plus size={14} /> 新增角色
            </button>
          </div>
        </div>
        <div className="flex-1 p-3 overflow-y-auto">
          {selected ? (
            <RoleConfigEditor
              title={`编辑：${selected.name}`}
              role={toRoleConfig(selected)}
              providers={providers}
              hideUserPromptTemplate
              onChange={updateSelected}
            />
          ) : (
            <div className="text-sm text-gray-600">请选择左侧角色进行编辑，或新增角色。</div>
          )}
          {selected && (
            <div className="mt-3 flex gap-2">
              <button onClick={deleteSelected} className="px-3 py-1 border rounded text-sm text-black hover:bg-gray-100">删除</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoleLibraryModal;
