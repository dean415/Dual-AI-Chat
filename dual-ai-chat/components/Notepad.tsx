
import React, { useState, useMemo } from 'react';
import { MessageSender } from '../types';
import { FileText, Eye, Code, Copy, Check, Maximize, Minimize, Undo2, Redo2 } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ThinkingAnimated from './ThinkingAnimated';

interface NotepadProps {
  content: string;
  lastUpdatedBy?: MessageSender | null;
  isLoading: boolean;
  isNotepadFullscreen: boolean;
  onToggleFullscreen: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onEdit?: (newContent: string) => void;
}

const Notepad: React.FC<NotepadProps> = ({ 
  content, 
  lastUpdatedBy, 
  isLoading, 
  isNotepadFullscreen, 
  onToggleFullscreen,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onEdit,
}) => {
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const processedHtml = useMemo(() => {
    if (isPreviewMode) {
      const rawHtml = marked.parse(content) as string;
      return DOMPurify.sanitize(rawHtml);
    }
    return '';
  }, [content, isPreviewMode]);

  // When switching到编辑态，自动聚焦文本框
  React.useEffect(() => {
    if (!isPreviewMode && textAreaRef.current) {
      // 仅在未加载时允许聚焦
      if (!isLoading) {
        textAreaRef.current.focus();
        // 将光标移动到文本末尾
        const len = textAreaRef.current.value.length;
        textAreaRef.current.setSelectionRange(len, len);
      }
    }
  }, [isPreviewMode, isLoading]);

  const handleCopyNotepad = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('无法复制记事本内容: ', err);
    }
  };

  const notepadBaseClasses = "h-full flex flex-col bg-white";
  const fullscreenClasses = "fixed top-0 left-0 w-screen h-screen z-50 shadow-2xl";

  const lines = useMemo(() => content.split('\n'), [content]);
  
  const baseButtonClass = "p-1.5 text-gray-500 hover:text-sky-600 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-500";


  return (
    <div className={`${notepadBaseClasses} ${isNotepadFullscreen ? fullscreenClasses : ''}`}>
      <header className="p-3 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center">
          <FileText size={20} className="mr-2 text-black" />
          <h2 className="text-lg font-semibold text-black serif-text">Canvas</h2>
        </div>
        <div className="flex items-center space-x-1 md:space-x-1.5">
          <button
            onClick={onUndo}
            disabled={!canUndo || isLoading}
            className={baseButtonClass}
            title="撤销记事本更改"
            aria-label="Undo notepad change"
            aria-disabled={!canUndo || isLoading}
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo || isLoading}
            className={baseButtonClass}
            title="重做记事本更改"
            aria-label="Redo notepad change"
            aria-disabled={!canRedo || isLoading}
          >
            <Redo2 size={18} />
          </button>
          <div className="h-4 w-px bg-gray-300 mx-1" aria-hidden="true"></div>
          <button
            onClick={onToggleFullscreen}
            className={baseButtonClass}
            title={isNotepadFullscreen ? "退出全屏" : "全屏"}
            aria-label={isNotepadFullscreen ? "Exit fullscreen notepad" : "Enter fullscreen notepad"}
          >
            {isNotepadFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button
            onClick={handleCopyNotepad}
            className={baseButtonClass}
            title={isCopied ? "已复制!" : "复制记事本内容"}
            aria-label={isCopied ? "已复制记事本内容到剪贴板" : "复制记事本内容"}
          >
            {isCopied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
          </button>
          <button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={baseButtonClass}
            title={isPreviewMode ? "查看原始内容" : "预览 Markdown"}
            aria-label={isPreviewMode ? "Switch to raw text view" : "Switch to Markdown preview"}
          >
            {isPreviewMode ? <Code size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </header>
      <div className="flex-grow overflow-y-auto relative bg-white">
        {isPreviewMode ? (
          <div
            className="markdown-preview notepad-scrollbar serif-text relative"
            aria-label="Markdown 预览"
            tabIndex={0}
            title={isLoading ? 'AI 正在处理，暂不可编辑' : '使用右侧按钮切换编辑/预览'}
          >
            <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
            {isLoading && (
              <div className="absolute top-2 left-2 pointer-events-none select-none">
                <ThinkingAnimated sizePx={28} />
              </div>
            )}
          </div>
        ) : (
          <textarea
            className="w-full h-full p-3 bg-white text-gray-800 serif-text text-base leading-relaxed outline-none resize-none notepad-scrollbar"
            aria-label="共享记事本内容 (可编辑)"
            value={content}
            onChange={(e) => onEdit && onEdit(e.target.value)}
            onInput={(e) => onEdit && onEdit((e.target as HTMLTextAreaElement).value)}
            disabled={isLoading}
            placeholder="在此编辑共享记事本内容..."
            ref={textAreaRef}
          />
        )}
      </div>
    </div>
  );
};

export default Notepad;
