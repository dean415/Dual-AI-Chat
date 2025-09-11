import React, { useState } from 'react';
import { DiscussionMode } from '../types';
import { X } from 'lucide-react';
import GeneralTab from './settings/GeneralTab';
import ApiChannelsTab from './settings/ApiChannelsTab';
import AdvancedTab from './settings/AdvancedTab';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;

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
  isLoading,
  fontSizeScale,
  onFontSizeScaleChange,
  // swallows the rest for compatibility
  ..._rest
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'channels' | 'advanced'>('general');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" role="dialog" aria-modal="true">
      <div className="bg-white w-[min(900px,95vw)] max-h-[90vh] rounded-lg shadow-xl overflow-hidden border border-gray-300 flex flex-col">
        <header className="px-5 py-3 border-b border-gray-300 flex justify-between items-center bg-gray-50">
          <h2 id="settings-modal-title" className="text-xl font-semibold text-sky-700">应用程序设置</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 focus:outline-none" aria-label="关闭设置">
            <X size={20} />
          </button>
        </header>

        <div className="px-5 pt-3 border-b bg-white">
          <nav className="flex gap-2" aria-label="设置页签">
            <button className={`px-3 py-2 text-sm rounded-t ${activeTab==='general' ? 'bg-sky-50 text-sky-700 border-b-2 border-sky-600' : 'text-gray-700 hover:bg-gray-50'}`} onClick={()=>setActiveTab('general')}>常规设置</button>
            <button className={`px-3 py-2 text-sm rounded-t ${activeTab==='channels' ? 'bg-sky-50 text-sky-700 border-b-2 border-sky-600' : 'text-gray-700 hover:bg-gray-50'}`} onClick={()=>setActiveTab('channels')}>API 渠道</button>
            <button className={`px-3 py-2 text-sm rounded-t ${activeTab==='advanced' ? 'bg-sky-50 text-sky-700 border-b-2 border-sky-600' : 'text-gray-700 hover:bg-gray-50'}`} onClick={()=>setActiveTab('advanced')}>高级设置</button>
          </nav>
        </div>

        <div className="p-5 overflow-y-auto settings-modal-content-scrollbar flex-1">
          {activeTab === 'general' && (
            <GeneralTab isLoading={isLoading} fontSizeScale={fontSizeScale} onFontSizeScaleChange={onFontSizeScaleChange} />
          )}
          {activeTab === 'channels' && (
            <ApiChannelsTab />
          )}
          {activeTab === 'advanced' && (
            <AdvancedTab />
          )}
        </div>

        <footer className="p-4 border-t border-gray-300 bg-gray-50 rounded-b-lg sticky bottom-0 z-10">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:bg-sky-300"
            disabled={isLoading}
            aria-label="完成并关闭设置"
          >
            完成
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;

