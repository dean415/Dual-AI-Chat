import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Settings2, SquarePen, PanelLeftOpen, PanelLeftClose, MoreHorizontal } from 'lucide-react';
import { createChat, getChats, setChats, setActiveChatId, getActiveChatId, subscribeChatStore, renameChat, deleteChat } from '../utils/chatStore';

interface ChatSidebarProps {
  isOpen: boolean;            // mobile drawer open/close
  onToggle: () => void;       // mobile toggle handler
  isCollapsed?: boolean;      // desktop collapsed (narrow) state
  onCollapseToggle?: () => void;
  onOpenSettings: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ isOpen, onToggle, isCollapsed, onCollapseToggle, onOpenSettings }) => {
  const widthPx = isCollapsed ? 48 : 260;
  const [chats, setChatsLocal] = useState(() => getChats());
  const [activeId, setActiveIdLocal] = useState(() => getActiveChatId());
  const [menuForId, setMenuForId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = subscribeChatStore(() => {
      setChatsLocal(getChats());
      setActiveIdLocal(getActiveChatId());
    });
    return () => unsub();
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuForId) return;
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) setMenuForId(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuForId]);

  // Keep stored order: default is newest first when created (we unshift on create),
  // and allow manual drag-reorder without implicit resorting on click/update.
  const sorted = useMemo(() => chats, [chats]);

  // Drag-and-drop reorder
  const dragIndexRef = useRef<number | null>(null);
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    dragIndexRef.current = index;
    try { e.dataTransfer.setData('text/plain', String(index)); } catch {}
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from == null || from === index) return;
    const list = [...getChats()];
    if (from < 0 || from >= list.length || index < 0 || index >= list.length) return;
    const [moved] = list.splice(from, 1);
    list.splice(index, 0, moved);
    setChats(list);
  };

  const handleNewChat = () => {
    try {
      const next = createChat();
      const list = getChats();
      setChats([next, ...list]);
      setActiveChatId(next.id);
    } catch (e) {
      console.error('Failed to create chat:', e);
    }
  };

  return (
    <aside
      className={[
        'fixed left-0 top-0 h-screen bg-white border-r border-gray-200 z-40 flex flex-col select-none',
        'transform transition-transform duration-200 ease-out',
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ].join(' ')}
      style={{ width: `${widthPx}px` }}
      aria-label="Chat sidebar"
    >
      {/* Header: collapse (desktop) + mobile toggle */}
      <div className={`flex items-center ${isCollapsed ? 'justify-start' : 'justify-end'} px-2 py-2`}>
        <button
          type="button"
          onClick={onCollapseToggle}
          className="hidden md:flex p-2 rounded text-gray-600 hover:text-black hover:bg-gray-100"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="md:hidden p-2 rounded text-gray-600 hover:text-black hover:bg-gray-100"
          aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
          title={isOpen ? 'Close' : 'Open'}
        >
          {isOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>

      {/* New chat */}
      {!isCollapsed && (
      <div className="px-3 pt-1">
        <button
          type="button"
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-100 text-black"
        >
          <SquarePen size={18} className="text-black" />
          <span className="text-base font-medium">New chat</span>
        </button>
      </div>
      )}

      {/* Chats header */}
      {!isCollapsed && (
      <div className="px-3 pt-2 pb-2">
        <div className="text-xs font-semibold text-gray-500">Chats</div>
      </div>
      )}
      {/* Chats list */}
      {!isCollapsed && (
      <div className="px-2 flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {sorted.map(chat => {
            const isActive = chat.id === activeId;
            const isEditing = editingId === chat.id;
            return (
              <li
                key={chat.id}
                className="group relative"
                draggable
                onDragStart={handleDragStart(sorted.indexOf(chat))}
                onDragOver={handleDragOver(sorted.indexOf(chat))}
                onDrop={handleDrop(sorted.indexOf(chat))}
                aria-grabbed="false"
              >
                <button
                  type="button"
                  onClick={() => { setActiveChatId(chat.id); setActiveIdLocal(chat.id); }}
                  className={`w-full flex items-center justify-between px-2 py-2 rounded ${isActive ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      defaultValue={chat.title}
                      onFocus={(e) => e.currentTarget.select()}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) renameChat(chat.id, v);
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') { setEditingId(null); }
                      }}
                      className="w-full bg-transparent outline-none text-black text-base"
                    />
                  ) : (
                    <span className="text-black text-base font-medium flex-1 text-left truncate max-w-[10ch] group-hover:max-w-[5ch]">{chat.title}</span>
                  )}
                  {/* Ellipsis button (hover only) */}
                  <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setMenuForId(chat.id === menuForId ? null : chat.id); }}
                      className="p-1.5 rounded text-gray-600 hover:text-black hover:bg-gray-100"
                      aria-label="More"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </span>
                </button>
                {/* Context menu */}
                {menuForId === chat.id && (
                  <div ref={menuRef} className="absolute right-2 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44 z-50">
                    <button
                      type="button"
                      onClick={() => { setMenuForId(null); setEditingId(chat.id); setDraftTitle(chat.title); }}
                      className="w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span>Rename</span>
                    </button>
                    <div className="h-px bg-gray-200 my-1" />
                    <button
                      type="button"
                      onClick={() => { setMenuForId(null); deleteChat(chat.id); }}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M8 6v-2a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      )}

      {/* Bottom settings */}
      <div className="mt-auto p-3">
        <button
          type="button"
          onClick={onOpenSettings}
          className={`${isCollapsed ? 'w-full flex justify-start px-2' : 'mx-auto flex justify-center px-3'} items-center gap-2 ${isCollapsed ? 'py-2' : 'py-2.5'} rounded text-gray-800 hover:text-black hover:bg-gray-100`}
          aria-label="Open settings"
        >
          <Settings2 size={18} />
          {!isCollapsed && <span className="text-sm font-semibold">Settings</span>}
        </button>
      </div>
    </aside>
  );
};

export default ChatSidebar;
