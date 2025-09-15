import React, { useState } from 'react';
import { X } from 'lucide-react';
import RoleConfigEditor from './RoleConfigEditor';
import type { ApiProviderConfig, RoleConfig, RoleLibraryItem } from '../types';

interface Props {
  isOpen: boolean;
  initial?: RoleLibraryItem;
  providers: ApiProviderConfig[];
  onCancel: () => void;
  onSave: (item: RoleLibraryItem) => void;
}

const RoleEditorModal: React.FC<Props> = ({ isOpen, initial, providers, onCancel, onSave }) => {
  const [draft, setDraft] = useState<RoleConfig>(() => initial ? {
    roleId: initial.id,
    displayName: initial.name,
    providerId: initial.providerId,
    modelId: initial.modelId,
    systemPrompt: initial.systemPrompt,
    userPromptTemplate: undefined,
    parameters: initial.parameters,
    streamingEnabled: initial.streamingEnabled,
  } : {
    roleId: 'role-' + Date.now().toString(),
    displayName: 'New Role',
    providerId: providers[0]?.id || '',
    modelId: providers[0]?.defaultModel || '',
    systemPrompt: '',
    userPromptTemplate: undefined,
    parameters: {},
    streamingEnabled: true,
  });

  const toItem = (rc: RoleConfig): RoleLibraryItem => ({
    id: rc.roleId,
    name: rc.displayName,
    providerId: rc.providerId,
    modelId: rc.modelId,
    systemPrompt: rc.systemPrompt,
    parameters: rc.parameters,
    streamingEnabled: rc.streamingEnabled,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w_[min(760px,95vw)] max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 'min(760px,95vw)' }}>
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="text-base font-semibold text-black">Role</div>
          <button onClick={onCancel} className="text-gray-600 hover:text-gray-800" aria-label="Close role editor">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          <RoleConfigEditor title="" role={draft} providers={providers} hideUserPromptTemplate onChange={setDraft} />
        </div>
        <div className="px-4 py-2 bg-white flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 border rounded text-sm text-black hover:bg-gray-100">Cancel</button>
          <button onClick={() => onSave(toItem(draft))} className="px-3 py-1.5 rounded bg-black text-white text-sm hover:bg-gray-800">Save</button>
        </div>
      </div>
    </div>
  );
};

export default RoleEditorModal;
