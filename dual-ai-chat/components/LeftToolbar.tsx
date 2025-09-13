import React from 'react';
import { Settings2, RefreshCcw as RefreshCwIcon } from 'lucide-react';

interface LeftToolbarProps {
  onOpenTeam: () => void; // kept for compatibility, no button rendered
  onOpenSettings: () => void;
  onClearChat?: () => void; // optional; hide button when undefined
  onOpenWorkflow?: () => void; // kept for compatibility, no button rendered
  disabled?: boolean;
}

const iconBtn =
  'p-2 rounded-lg text-gray-700 hover:text-sky-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed';

const LeftToolbar: React.FC<LeftToolbarProps> = ({ onOpenTeam, onOpenSettings, onClearChat, onOpenWorkflow, disabled }) => {
  return (
    <aside
      className="fixed left-0 top-0 h-screen w-12 md:w-14 bg-white z-40 flex flex-col items-center justify-start py-3 gap-4 select-none"
      aria-label="侧边工具栏"
    >
      {/* Removed Team/Workflow buttons (already accessible in Settings) */}
      <button
        onClick={onOpenSettings}
        className={iconBtn}
        aria-label="打开设置"
        title="设置"
        disabled={disabled}
      >
        <Settings2 size={20} />
      </button>
      {onClearChat && (
        <button
          onClick={onClearChat}
          className={iconBtn}
          aria-label="清空会话"
          title="清空"
          disabled={disabled}
        >
          <RefreshCwIcon size={20} />
        </button>
      )}
    </aside>
  );
};

export default LeftToolbar;
