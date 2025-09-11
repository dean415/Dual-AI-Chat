
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Paperclip, XCircle, StopCircle } from 'lucide-react';

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

      <div className="relative">
        {/* inline left controls */}
        {/* Left-side controls (Stop Generating) */}
        <div className="absolute left-2 top-5 flex items-center gap-2 z-20 pointer-events-auto">
          {isLoading && (
            <button
              type="button"
              onClick={onStopGenerating}
              className="p-2 rounded-full bg-white border border-gray-300 text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              aria-label="停止生成"
              title="停止生成"
              disabled={!isLoading}
            >
              <StopCircle size={20} />
            </button>
          )}
        </div>

        {/* Right-side paperclip vertically centered regardless of textarea height */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[1.25rem] h-[1.6em] flex items-center z-10 pointer-events-auto">
          <button
            type="button"
            onClick={handleFileButtonClick}
            className="h-full w-[1.6em] p-0 text-gray-600 hover:text-sky-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center leading-none"
            disabled={isDisabledInput}
            aria-label="添加图片附件"
            title="添加图片"
          >
            <Paperclip className="w-full h-full" />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          placeholder="Ask Me Anything"
          className={`w-full ${leftPaddingClass} ${rightPaddingClass} py-5 bg-white border border-gray-300 rounded-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none placeholder-gray-500 text-gray-800 disabled:opacity-60 resize-none overflow-y-auto no-scrollbar min-h-[64px] max-h-[128px] leading-[1.6] ${isDraggingOver ? 'ring-2 ring-sky-500 border-sky-500' : ''}`}
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
