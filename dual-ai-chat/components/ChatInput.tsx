
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, XCircle, StopCircle, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getRoleLibrary } from '../utils/workflowStore';
import { collectRecentMixedHistoryN } from '../utils/promptOptimizer';
import { runRole } from '../services/roleRunner';
import type { RoleConfig } from '../types';
import { getOptimizerEnabled, getOptimizerN, getOptimizerRoleName, getOptimizerTemplate } from '../utils/promptOptimizerStore';
import OptimizerRainbow from './OptimizerRainbow';

interface ChatInputProps {
  onSendMessage: (message: string, imageFile?: File | null) => void;
  isLoading: boolean;
  isApiKeyMissing: boolean;
  onStopGenerating: () => void; // New prop
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, isApiKeyMissing, onStopGenerating }) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizerStage, setOptimizerStage] = useState<'idle'|'start'|'active'|'end'>('idle');
  const [sparkPulse, setSparkPulse] = useState<boolean>(false);
  const [textFade, setTextFade] = useState<boolean>(false);
  const { state: appState } = useAppStore();

  useEffect(() => {
    if (selectedImage) {
      const objectUrl = URL.createObjectURL(selectedImage);
      setImagePreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setImagePreviewUrl(null);
  }, [selectedImage]);

  const handleImageFile = (file: File | null) => {
    if (file && ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setSelectedImage(file);
    } else if (file) {
      alert('不支持的文件类型。请选择 JPG, PNG, GIF, 或 WEBP 格式的图片。');
      setSelectedImage(null);
    } else {
      setSelectedImage(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreviewUrl(null);
  };

  const triggerSendMessage = () => {
    if ((inputValue.trim() || selectedImage) && !isLoading && !isApiKeyMissing) {
      onSendMessage(inputValue.trim(), selectedImage);
      setInputValue('');
      removeImage();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // This will only be called if the button's type is "submit" (i.e., !isLoading)
    triggerSendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Only trigger send if not loading; stop button handles its own click
      if (!isLoading) {
        triggerSendMessage();
      }
    }
    // No specific action needed for Shift+Enter, as the default textarea behavior is to add a newline.
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (ACCEPTED_IMAGE_TYPES.includes(items[i].type)) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageFile(file);
            e.preventDefault();
            break;
          }
        }
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleImageFile(e.target.files[0]);
    }
  };

  const isDisabledInput = isLoading || isApiKeyMissing;
  const processing = optimizerStage === 'start' || optimizerStage === 'active';
  const wrapperClass = `relative chat-input-area`;

  const handleOptimizeClick = useCallback(async () => {
    try {
      if (isOptimizing) return;
      if (isLoading || isApiKeyMissing) return;
      const enabled = getOptimizerEnabled();
      if (!enabled) return;
      const roleName = getOptimizerRoleName();
      const template = getOptimizerTemplate();
      if (!roleName || !template || !template.trim()) return;
      const n = getOptimizerN();
      const recent = collectRecentMixedHistoryN(n);
      const current = (typeof inputValue === 'string' ? inputValue : '') || '';
      const lib = getRoleLibrary();
      const libRole = lib.find(r => r.name === roleName);
      if (!libRole) return;
      const provider = appState.apiProviders.find(p => p.id === libRole.providerId);
      if (!provider) return;

      const tempRole: RoleConfig = {
        roleId: 'prompt-optimizer-temp',
        displayName: 'PromptOptimizer',
        providerId: libRole.providerId,
        modelId: libRole.modelId,
        systemPrompt: libRole.systemPrompt,
        userPromptTemplate: template,
        parameters: libRole.parameters,
      };

      setIsOptimizing(true);
      setOptimizerStage('start');
      setSparkPulse(true);
      window.setTimeout(() => setSparkPulse(false), 280);
      window.setTimeout(() => setOptimizerStage('active'), 240);
      const res = await runRole({
        provider,
        role: tempRole,
        templateVars: {
          recent_mixed_messages: recent,
          current_input: current,
        },
      });
      if (!res.errorCode) {
        const next = (res.text || '').toString();
        if (next && next.trim()) {
          setInputValue(next);
          setTextFade(true);
          if (textareaRef.current) {
            const target = textareaRef.current;
            target.style.height = 'auto';
            target.value = next;
            target.style.height = `${target.scrollHeight}px`;
          }
          window.setTimeout(() => setTextFade(false), 260);
        }
      }
    } catch {
      // silent failure
    } finally {
      setOptimizerStage('end');
      window.setTimeout(() => { setIsOptimizing(false); setOptimizerStage('idle'); }, 260);
    }
  }, [isOptimizing, isLoading, isApiKeyMissing, inputValue, appState.apiProviders]);

  // dynamic left padding for textarea to avoid overlapping inline controls
  // Left padding accounts for the left-side stop button when loading
  const leftPaddingClass = isLoading ? 'pl-20' : 'pl-10';
  // Right padding reserves space for the paperclip icon
  const rightPaddingClass = 'pr-12';

  return (
    <form onSubmit={handleSubmit} className="px-4 pt-4 pb-0 mb-0 bg-white">
      {imagePreviewUrl && selectedImage && (
        <div className="mb-2 p-2 bg-gray-200 rounded-md relative max-w-xs border border-gray-300">
          <img src={imagePreviewUrl} alt={selectedImage.name || '图片预览'} className="max-h-24 max-w-full rounded" />
          <button
            type="button"
            onClick={removeImage}
            className="absolute top-1 right-1 bg-black/40 text-white rounded-full p-0.5 hover:bg-black/60"
            aria-label="移除图片"
          >
            <XCircle size={20} />
          </button>
          <div className="text-xs text-gray-600 mt-1 truncate">{selectedImage.name} ({(selectedImage.size / 1024).toFixed(1)} KB)</div>
        </div>
      )}

      <div className={wrapperClass} ref={/* anchor for rainbow overlay alignment */ (el) => { (wrapperRef as any).current = el as HTMLDivElement; }}>
        {/* inline left controls */}
        {/* Left-side controls (Stop Generating) */}
        <div className="absolute left-2 top-5 flex items-center gap-2 z-20 pointer-events-auto">
          {isLoading && (
            <button
              type="button"
              onClick={onStopGenerating}
              className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 border border-transparent shadow-sm focus:outline-none disabled:opacity-50"
              aria-label="停止生成"
              title="停止生成"
              disabled={!isLoading}
            >
              <span className="block w-3.5 h-3.5 bg-black rounded-[4px]" />
            </button>
          )}
        </div>

        {/* Right-side add icon vertically centered regardless of textarea height */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[1.25rem] h-[1.6em] flex items-center z-10 pointer-events-auto">
          {/* Prompt Optimizer sparkles button to the left of plus */}
          <button
            type="button"
            onClick={handleOptimizeClick}
            className={`h-full w-[1.6em] mr-1 p-0 text-gray-600 hover:text-sky-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center leading-none ${sparkPulse ? 'sparkles-pulse' : ''}`}
            disabled={isDisabledInput}
            aria-label="Run Prompt Optimizer"
          >
            <Sparkles className="w-[1.05em] h-[1.05em]" />
          </button>
          <button
            type="button"
            onClick={handleFileButtonClick}
            className="h-full w-[1.6em] p-0 text-gray-600 hover:text-sky-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center leading-none"
            disabled={isDisabledInput}
            aria-label="添加图片附件"
            title="添加图片"
          >
            <Plus className="w-[1.05em] h-[1.05em]" />
          </button>
        </div>

        {/* Rainbow overlay (SVG, SMIL-based). Uses textareaRef for sizing. */}
        <OptimizerRainbow targetRef={textareaRef as any} anchorRef={wrapperRef as any} stage={optimizerStage} thickness={6} speedSec={1.6} />

        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          placeholder="Ask anything"
          className={`w-full ${leftPaddingClass} ${rightPaddingClass} py-5 bg-white border border-gray-300 rounded-full focus:ring-0 focus:border-gray-300 outline-none placeholder-gray-500 text-gray-800 serif-text disabled:opacity-60 resize-none overflow-y-auto no-scrollbar min-h-[64px] max-h-[128px] leading-[1.6] ${isDraggingOver ? 'ring-2 ring-sky-500 border-sky-500' : ''}`}
          style={{ opacity: processing ? 0.6 : 1, borderColor: processing ? 'transparent' : undefined }}
          rows={1}
          disabled={isDisabledInput}
          aria-label="聊天输入框"
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
          }}
        />

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelected}
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="hidden"
          aria-label="选择图片文件"
        />
      </div>
    </form>
  );
};

export default ChatInput;
