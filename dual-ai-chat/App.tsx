

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { ChatMessage, MessageSender, MessagePurpose, FailedStepPayload, DiscussionMode, MoaStepId, MoaStepResult } from './types';
import ChatInput from './components/ChatInput';
import MessageBubble from './components/MessageBubble';
import Notepad from './components/Notepad';
import SettingsModal from './components/SettingsModal';
// TeamManagementModal removed from UI in favor of RoleLibrary/Workflow
import RoleLibraryModal from './components/RoleLibraryModal';
import {
  MODELS,
  DEFAULT_COGNITO_MODEL_API_NAME, 
  DEFAULT_MUSE_MODEL_API_NAME,    
  COGNITO_SYSTEM_PROMPT_HEADER,
  MUSE_SYSTEM_PROMPT_HEADER,
  DEFAULT_MANUAL_FIXED_TURNS,
  MIN_MANUAL_FIXED_TURNS,
  AiModel,
  // Gemini Custom API Keys
  CUSTOM_API_ENDPOINT_STORAGE_KEY,
  CUSTOM_API_KEY_STORAGE_KEY,
  USE_CUSTOM_API_CONFIG_STORAGE_KEY, 
  // OpenAI Custom API Keys
  USE_OPENAI_API_CONFIG_STORAGE_KEY,
  OPENAI_API_BASE_URL_STORAGE_KEY,
  OPENAI_API_KEY_STORAGE_KEY,
  OPENAI_COGNITO_MODEL_ID_STORAGE_KEY,
  OPENAI_MUSE_MODEL_ID_STORAGE_KEY,
  DEFAULT_OPENAI_API_BASE_URL,
  DEFAULT_OPENAI_COGNITO_MODEL_ID,
  DEFAULT_OPENAI_MUSE_MODEL_ID,
} from './constants';
import { AlertTriangle, RefreshCcw as RefreshCwIcon, Settings2, Database } from 'lucide-react'; 

import { useChatLogic } from './hooks/useChatLogic';
import { useNotepadLogic } from './hooks/useNotepadLogic';
import { useAppUI } from './hooks/useAppUI';
import { generateUniqueId, fileToBase64, parseAIResponse } from './utils/appUtils';
import { useAppStore } from './store/appStore';
import { useMoeLogic } from './hooks/useMoeLogic';
import type { MoeTeamPreset, TeamPreset, ApiProviderConfig } from './types';
import MoaBubble from './components/MoaBubble';
// import LeftToolbar from './components/LeftToolbar'; // replaced by ChatSidebar
import ChatSidebar from './components/ChatSidebar';
import WorkflowEditorModal from './components/WorkflowEditorModal';
import { subscribeWorkflowStore } from './utils/workflowStore';
import { appendMessageToActiveChat, appendNotepadSnapshotToActiveChat, getActiveChatUserHistory, ensureInitialChat } from './utils/chatStore';
import useWorkflowOrchestrator from './hooks/useWorkflowOrchestrator';
import WorkflowBubble from './components/WorkflowBubble';
import WorkflowSelector from './components/WorkflowSelector';
import { subscribeChatStore, getActiveChat, getActiveChatId } from './utils/chatStore';
import { getRoleLibrary, getWorkflowPresets, getActiveWorkflowId } from './utils/workflowStore';
import type { WorkflowPresetMinimal } from './types';
import type { WorkflowRoundView, WorkflowStepView } from './components/WorkflowBubble';

const DEFAULT_CHAT_PANEL_PERCENT = 60; 
const FONT_SIZE_STORAGE_KEY = 'dualAiChatFontSizeScale';
const DEFAULT_FONT_SIZE_SCALE = 0.875;
const THEME_STORAGE_KEY = 'dualAiChatTheme';
type AppTheme = 'default' | 'claude' | 'dark';
const DEFAULT_GEMINI_CUSTOM_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';

interface ApiKeyStatus {
  isMissing?: boolean;
  isInvalid?: boolean;
  message?: string;
}

  const App: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [moeRunHistory, setMoeRunHistory] = useState<Array<{ id: string; steps: Record<MoaStepId, MoaStepResult>; startedAt: number; anchorMessageId: string }>>([]);
  const [currentMoeEvent, setCurrentMoeEvent] = useState<{ runId: string; startedAt: number; anchorMessageId: string } | null>(null);
  const [currentWorkflowEvent, setCurrentWorkflowEvent] = useState<{ runId: string; startedAt: number; anchorMessageId: string; rounds: WorkflowRoundView[]; name: string } | null>(null);
  const [workflowRunHistory, setWorkflowRunHistory] = useState<Array<{ id: string; rounds: WorkflowRoundView[]; startedAt: number; anchorMessageId: string; name: string }>>([]);
  const { state: appState } = useAppStore();
  const hideLegacyModelSelectors = !!(appState && appState.activeTeamId);
  const [isRoleLibraryOpen, setIsRoleLibraryOpen] = useState<boolean>(false);
  const [isWorkflowEditorOpen, setIsWorkflowEditorOpen] = useState<boolean>(false);
  const [workflowStoreVersion, setWorkflowStoreVersion] = useState<number>(0);
  const [chatStoreVersion, setChatStoreVersion] = useState<number>(0);
  const WORKFLOW_DEBUG_STORAGE_KEY = 'dualAiChatWorkflowDebug';
  const [showWorkflowDebug, setShowWorkflowDebug] = useState<boolean>(() => {
    try { const v = localStorage.getItem(WORKFLOW_DEBUG_STORAGE_KEY); return v ? v === 'true' : false; } catch { return false; }
  });
  // Streaming preferences (General)
  const STREAMING_ENABLED_STORAGE_KEY = 'dualAiChat.streaming.enabled';
  const STREAMING_INTERVAL_MS_STORAGE_KEY = 'dualAiChat.streaming.intervalMs';
  const TYPING_CARET_ENABLED_STORAGE_KEY = 'dualAiChat.typingCaret.enabled';
  const [streamingEnabled, setStreamingEnabled] = useState<boolean>(() => {
    try { const v = localStorage.getItem(STREAMING_ENABLED_STORAGE_KEY); return v === null ? true : v === 'true'; } catch { return true; }
  });
  const [streamIntervalMs, setStreamIntervalMs] = useState<number>(() => {
    try { const v = parseInt(localStorage.getItem(STREAMING_INTERVAL_MS_STORAGE_KEY) || '30', 10); return isNaN(v) ? 30 : v; } catch { return 30; }
  });
  const [typingCaretEnabled, setTypingCaretEnabled] = useState<boolean>(() => {
    try { const v = localStorage.getItem(TYPING_CARET_ENABLED_STORAGE_KEY); return v === null ? true : v === 'true'; } catch { return true; }
  });
  // Theme: persisted in localStorage, basic HTML data attribute for future styling
  const [theme, setTheme] = useState<AppTheme>(() => {
    try { const v = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null; return v || 'default'; } catch { return 'default'; }
  });
  
  // Ensure there is at least one chat and an activeChatId for per-chat history
  useEffect(() => {
    try { ensureInitialChat(); } catch {}
  }, []);

  // Gemini Custom API Config State
  const [useCustomApiConfig, setUseCustomApiConfig] = useState<boolean>(() => {
    const storedValue = localStorage.getItem(USE_CUSTOM_API_CONFIG_STORAGE_KEY);
    return storedValue ? storedValue === 'true' : false; 
  });
  const [customApiEndpoint, setCustomApiEndpoint] = useState<string>(() => localStorage.getItem(CUSTOM_API_ENDPOINT_STORAGE_KEY) || DEFAULT_GEMINI_CUSTOM_API_ENDPOINT);
  const [customApiKey, setCustomApiKey] = useState<string>(() => localStorage.getItem(CUSTOM_API_KEY_STORAGE_KEY) || '');
  
  // OpenAI-Compatible API Config State
  const [useOpenAiApiConfig, setUseOpenAiApiConfig] = useState<boolean>(() => {
    const storedValue = localStorage.getItem(USE_OPENAI_API_CONFIG_STORAGE_KEY);
    // If Gemini custom config was already enabled from old storage, default OpenAI to false.
    if (useCustomApiConfig && storedValue === null) return false;
    return storedValue ? storedValue === 'true' : false;
  });
  const [openAiApiBaseUrl, setOpenAiApiBaseUrl] = useState<string>(() => localStorage.getItem(OPENAI_API_BASE_URL_STORAGE_KEY) || DEFAULT_OPENAI_API_BASE_URL);
  const [openAiApiKey, setOpenAiApiKey] = useState<string>(() => localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || '');
  const [openAiCognitoModelId, setOpenAiCognitoModelId] = useState<string>(() => localStorage.getItem(OPENAI_COGNITO_MODEL_ID_STORAGE_KEY) || DEFAULT_OPENAI_COGNITO_MODEL_ID);
  const [openAiMuseModelId, setOpenAiMuseModelId] = useState<string>(() => localStorage.getItem(OPENAI_MUSE_MODEL_ID_STORAGE_KEY) || DEFAULT_OPENAI_MUSE_MODEL_ID);


  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({});

  // Settings State
  const [selectedCognitoModelApiName, setSelectedCognitoModelApiName] = useState<string>(DEFAULT_COGNITO_MODEL_API_NAME);
  const [selectedMuseModelApiName, setSelectedMuseModelApiName] = useState<string>(DEFAULT_MUSE_MODEL_API_NAME);
  const [discussionMode, setDiscussionMode] = useState<DiscussionMode>(DiscussionMode.AiDriven);
  const [manualFixedTurns, setManualFixedTurns] = useState<number>(DEFAULT_MANUAL_FIXED_TURNS);
  const [isThinkingBudgetActive, setIsThinkingBudgetActive] = useState<boolean>(true); // Applicable to Gemini
  const [cognitoSystemPrompt, setCognitoSystemPrompt] = useState<string>(COGNITO_SYSTEM_PROMPT_HEADER);
  const [museSystemPrompt, setMuseSystemPrompt] = useState<string>(MUSE_SYSTEM_PROMPT_HEADER);
  const [fontSizeScale, setFontSizeScale] = useState<number>(() => {
    const storedScale = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    return storedScale ? parseFloat(storedScale) : DEFAULT_FONT_SIZE_SCALE;
  });
  
  const panelsContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState<boolean>(true);


  const {
    isNotepadFullscreen,
    setIsNotepadFullscreen, 
    chatPanelWidthPercent,
    currentTotalProcessingTimeMs,
    isSettingsModalOpen,
    toggleNotepadFullscreen,
    handleMouseDownOnResizer,
    handleResizerKeyDown,
    openSettingsModal,
    closeSettingsModal,
    startProcessingTimer,
    stopProcessingTimer,
    updateProcessingTimer,
    currentQueryStartTimeRef, 
    setChatPanelWidthPercent, 
  } = useAppUI(DEFAULT_CHAT_PANEL_PERCENT, panelsContainerRef);

  const {
    notepadContent,
    lastNotepadUpdateBy,
    processNotepadUpdateFromAI,
    clearNotepadContent,
    applyUserEdit,
    undoNotepad,
    redoNotepad,
    canUndo,
    canRedo,
  } = useNotepadLogic("");

  const addMessage = useCallback((
    text: string,
    sender: MessageSender,
    purpose: MessagePurpose,
    durationMs?: number,
    image?: ChatMessage['image']
  ): string => {
    const messageId = generateUniqueId();
    setMessages(prev => [...prev, {
      id: messageId,
      text,
      sender,
      purpose,
      timestamp: new Date(),
      durationMs,
      image,
    }]);
    try {
      // Persist every chat bubble to the active chat timeline
      appendMessageToActiveChat({ text, sender, purpose, durationMs, image });
    } catch {}
    return messageId;
  }, []);

  // Remove trailing system placeholder bubbles like “正在…/等待…/准备…”，used when cancelling
  const prunePendingSystemPlaceholders = useCallback(() => {
    setMessages(prev => {
      const next = [...prev];
      let i = next.length - 1;
      while (i >= 0) {
        const m = next[i];
        const isSystemNotice = m.sender === MessageSender.System && m.purpose === MessagePurpose.SystemNotification;
        const text = (m.text || '').toString();
        const looksLikePlaceholder = /正在|等待|准备/.test(text);
        if (isSystemNotice && looksLikePlaceholder) {
          next.pop();
          i--;
          continue;
        }
        break;
      }
      return next;
    });
  }, []);

  // Remove the most recent AI bubble (Cognito/Muse) after the last user message
  const removeLatestAiBubble = useCallback(() => {
    setMessages(prev => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        const m = next[i];
        if (m.sender === MessageSender.User) break; // do not cross previous round
        if ((m.sender === MessageSender.Cognito || m.sender === MessageSender.Muse) && m.purpose !== MessagePurpose.SystemNotification) {
          next.splice(i, 1);
          break;
        }
      }
      return next;
    });
  }, []);
  
  // Determine actual model details based on active API configuration
  const actualCognitoModelDetails: AiModel = useMemo(() => {
    if (useOpenAiApiConfig) {
      return {
        id: 'openai-cognito',
        name: `OpenAI Cognito: ${openAiCognitoModelId || 'Unspecified'}`,
        apiName: openAiCognitoModelId || DEFAULT_OPENAI_COGNITO_MODEL_ID,
        supportsThinkingConfig: false, 
        supportsSystemInstruction: true, 
      };
    }
    return MODELS.find(m => m.apiName === selectedCognitoModelApiName) || MODELS[0];
  }, [useOpenAiApiConfig, openAiCognitoModelId, selectedCognitoModelApiName]);

  const actualMuseModelDetails: AiModel = useMemo(() => {
    if (useOpenAiApiConfig) {
      return { 
        id: 'openai-muse',
        name: `OpenAI Muse: ${openAiMuseModelId || 'Unspecified'}`,
        apiName: openAiMuseModelId || DEFAULT_OPENAI_MUSE_MODEL_ID,
        supportsThinkingConfig: false,
        supportsSystemInstruction: true,
      };
    }
    return MODELS.find(m => m.apiName === selectedMuseModelApiName) || MODELS[0];
  }, [useOpenAiApiConfig, openAiMuseModelId, selectedMuseModelApiName]);


  const {
    isLoading,
    failedStepInfo,
    startChatProcessing,
    retryFailedStep,
    stopGenerating: stopChatLogicGeneration, 
    cancelRequestRef, 
    currentDiscussionTurn,
    isInternalDiscussionActive,
    lastCompletedTurnCount, // Added
  } = useChatLogic({
    addMessage,
    processNotepadUpdateFromAI,
    setGlobalApiKeyStatus: setApiKeyStatus,
    cognitoModelDetails: actualCognitoModelDetails, 
    museModelDetails: actualMuseModelDetails,    
    // Gemini Custom Config
    useCustomApiConfig, 
    customApiKey,
    customApiEndpoint,
    // OpenAI Custom Config
    useOpenAiApiConfig,
    openAiApiKey,
    openAiApiBaseUrl,
    openAiCognitoModelId,
    openAiMuseModelId,
    // Shared Settings
    discussionMode,
    manualFixedTurns,
    isThinkingBudgetActive, 
    cognitoSystemPrompt,
    museSystemPrompt,
    notepadContent, 
    startProcessingTimer,
    stopProcessingTimer,
    currentQueryStartTimeRef,
  });

  // Save Gemini custom config
  useEffect(() => { localStorage.setItem(USE_CUSTOM_API_CONFIG_STORAGE_KEY, useCustomApiConfig.toString()); }, [useCustomApiConfig]);
  useEffect(() => { localStorage.setItem(CUSTOM_API_ENDPOINT_STORAGE_KEY, customApiEndpoint); }, [customApiEndpoint]);
  useEffect(() => { localStorage.setItem(CUSTOM_API_KEY_STORAGE_KEY, customApiKey); }, [customApiKey]);

  // Save OpenAI custom config
  useEffect(() => { localStorage.setItem(USE_OPENAI_API_CONFIG_STORAGE_KEY, useOpenAiApiConfig.toString()); }, [useOpenAiApiConfig]);
  useEffect(() => { localStorage.setItem(OPENAI_API_BASE_URL_STORAGE_KEY, openAiApiBaseUrl); }, [openAiApiBaseUrl]);
  useEffect(() => { localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, openAiApiKey); }, [openAiApiKey]);
  useEffect(() => { localStorage.setItem(OPENAI_COGNITO_MODEL_ID_STORAGE_KEY, openAiCognitoModelId); }, [openAiCognitoModelId]);
  useEffect(() => { localStorage.setItem(OPENAI_MUSE_MODEL_ID_STORAGE_KEY, openAiMuseModelId); }, [openAiMuseModelId]);


  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSizeScale * 100}%`;
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSizeScale.toString());
  }, [fontSizeScale]);

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    try { localStorage.setItem(WORKFLOW_DEBUG_STORAGE_KEY, showWorkflowDebug ? 'true' : 'false'); } catch {}
  }, [showWorkflowDebug]);
  useEffect(() => {
    try { localStorage.setItem(STREAMING_ENABLED_STORAGE_KEY, streamingEnabled ? 'true' : 'false'); } catch {}
  }, [streamingEnabled]);
  useEffect(() => {
    try { localStorage.setItem(STREAMING_INTERVAL_MS_STORAGE_KEY, String(streamIntervalMs)); } catch {}
  }, [streamIntervalMs]);
  useEffect(() => {
    try { localStorage.setItem(TYPING_CARET_ENABLED_STORAGE_KEY, typingCaretEnabled ? 'true' : 'false'); } catch {}
  }, [typingCaretEnabled]);

  // react to chat store changes
  useEffect(() => {
    const unsub = subscribeChatStore(() => setChatStoreVersion(v => v + 1));
    return () => unsub();
  }, []);

  // Track active chat id to clear UI on change (hook added after orchestrator is defined)
  const lastChatIdRef = useRef<string | null>(null);

  const isEffectivelyApiKeyMissing = useMemo(() => {
    if (useOpenAiApiConfig) {
      return !openAiApiBaseUrl.trim() || !openAiCognitoModelId.trim() || !openAiMuseModelId.trim();
    } else if (useCustomApiConfig) {
      return !customApiKey.trim();
    } else {
      return !(process.env.API_KEY && process.env.API_KEY.trim() !== "");
    }
  }, [useCustomApiConfig, customApiKey, useOpenAiApiConfig, openAiApiBaseUrl, openAiApiKey, openAiCognitoModelId, openAiMuseModelId]);

  const initializeChat = useCallback(() => {
    setMessages([]);
    setMoeRunHistory([]);
    setCurrentMoeEvent(null);
    setWorkflowRunHistory([]);
    setCurrentWorkflowEvent(null);
    setMoeRunHistory([]);
    clearNotepadContent();
    setIsNotepadFullscreen(false); 
    setIsAutoScrollEnabled(true);
    setApiKeyStatus({});

    let missingKeyMsg = "";
    if (useOpenAiApiConfig) {
      if (!openAiApiBaseUrl.trim() || !openAiCognitoModelId.trim() || !openAiMuseModelId.trim()) {
        missingKeyMsg = "OpenAI API config is incomplete (requires base URL and Cognito/Muse model IDs). Provide them in Settings or disable 'Use OpenAI API config'.";
      }
    } else if (useCustomApiConfig) {
      if (!customApiKey.trim()) {
        missingKeyMsg = "Custom Gemini API key is missing. Enter the key in Settings or disable 'Use Custom API config'.";
      }
    } else {
      if (!(process.env.API_KEY && process.env.API_KEY.trim() !== "")) {
        missingKeyMsg = "Google Gemini API key is not configured in the environment. Configure it, or enable and provide a custom API config in Settings.";
      }
    }

    if (missingKeyMsg) {
      const fullWarning = `Critical warning: ${missingKeyMsg} App features are limited until this is resolved.`;
      addMessage(fullWarning, MessageSender.System, MessagePurpose.SystemNotification);
      setApiKeyStatus({ isMissing: true, message: missingKeyMsg });
    }
  }, [addMessage, clearNotepadContent, actualCognitoModelDetails.name, actualMuseModelDetails.name, discussionMode, manualFixedTurns, setIsNotepadFullscreen, useCustomApiConfig, customApiKey, useOpenAiApiConfig, openAiApiBaseUrl, openAiApiKey, openAiCognitoModelId, openAiMuseModelId]);

  useEffect(() => {
    initializeChat();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCustomApiConfig, useOpenAiApiConfig]); // Re-initialize if API config mode changes



  useEffect(() => {
    let intervalId: number | undefined;
    if (isLoading && currentQueryStartTimeRef.current) {
      intervalId = window.setInterval(() => {
        if (currentQueryStartTimeRef.current && !cancelRequestRef.current) { 
          updateProcessingTimer();
        }
      }, 100);
    } else {
      if (intervalId) clearInterval(intervalId);
      if (!isLoading && currentQueryStartTimeRef.current !== null) {
         updateProcessingTimer(); 
      }
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoading, updateProcessingTimer, currentQueryStartTimeRef, cancelRequestRef]);

  const handleClearChat = useCallback(() => {
    if (isLoading) {
      stopChatLogicGeneration(); 
    }
    initializeChat(); 
  }, [isLoading, stopChatLogicGeneration, initializeChat]);

  const handleStopGeneratingAppLevel = useCallback(() => {
    // 锟?MoE 濡€崇础娑撳绱濇担璺ㄦ暏 MoE 閻ㄥ嫬浠犲顫幢閸氾箑鍨穱婵囧瘮閸樼喐婀侀柅鏄忕帆
    if (activeTeam && activeTeam.mode === 'moe') {
      // will be defined later; placeholder for type
    } else {
      stopChatLogicGeneration();
    }
  }, [stopChatLogicGeneration]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isNotepadFullscreen) {
        toggleNotepadFullscreen();
      }
      if (event.key === 'Escape' && isSettingsModalOpen) {
        closeSettingsModal();
      }
    };
    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isNotepadFullscreen, toggleNotepadFullscreen, isSettingsModalOpen, closeSettingsModal]);

  const Separator = () => <div className="h-6 w-px bg-gray-300 mx-1 md:mx-1.5" aria-hidden="true"></div>;

  const [roleEditorPreselectName, setRoleEditorPreselectName] = useState<string | null>(null);
  const openTeamModal = useCallback(() => setIsRoleLibraryOpen(true), []);
  const openRoleEditorForName = useCallback((name?: string) => { setRoleEditorPreselectName(name || null); setIsRoleLibraryOpen(true); }, []);
  const closeTeamModal = useCallback(() => { setIsRoleLibraryOpen(false); setRoleEditorPreselectName(null); }, []);
  const openWorkflowModal = useCallback(() => setIsWorkflowEditorOpen(true), []);
  const closeWorkflowModal = useCallback(() => setIsWorkflowEditorOpen(false), []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  useEffect(() => {
    if (isAutoScrollEnabled && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isAutoScrollEnabled, scrollToBottom]);

  const handleChatScroll = useCallback(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const atBottom = scrollHeight - scrollTop - clientHeight < 20;

      if (atBottom) {
        setIsAutoScrollEnabled(true);
      } else {
        setIsAutoScrollEnabled(false);
      }
    }
  }, []);

  const apiKeyBannerMessage = useMemo(() => {
    if (!apiKeyStatus.message) return null;
    if (useOpenAiApiConfig) {
        if (apiKeyStatus.isMissing) return "OpenAI API config is incomplete (base URL + Cognito/Muse model IDs).";
        if (apiKeyStatus.isInvalid) return "Provided OpenAI API key is invalid or service is unreachable.";
    } else if (useCustomApiConfig) {
        if (apiKeyStatus.isMissing) return "Custom Gemini API key is missing.";
        if (apiKeyStatus.isInvalid) return "Custom Gemini API key is invalid or lacks permissions.";
    } else {
        if (apiKeyStatus.isMissing) return "Google Gemini API key is missing from environment.";
        if (apiKeyStatus.isInvalid) return "Google Gemini API key in environment is invalid or unauthorized.";
    }
    return apiKeyStatus.message; 
  }, [apiKeyStatus, useCustomApiConfig, useOpenAiApiConfig]);

  // ===== MoE 閹恒儱鍙嗛敍姘愁吀锟?activeTeam 锟?hooks =====
  const activeTeam: TeamPreset | undefined = useMemo(() => {
    return appState.teamPresets.find(t => t.id === appState.activeTeamId);
  }, [appState.teamPresets, appState.activeTeamId]);

  const providersById: Record<string, ApiProviderConfig> = useMemo(() => {
    const map: Record<string, ApiProviderConfig> = {};
    for (const p of appState.apiProviders) map[p.id] = p;
    return map;
  }, [appState.apiProviders]);

  // Keep active workflow reactive to editor changes
  useEffect(() => {
    const unsubscribe = subscribeWorkflowStore(() => setWorkflowStoreVersion(v => v + 1));
    return () => { try { unsubscribe(); } catch {} };
  }, []);
  // Active workflow is selected per chat via WorkflowSelector (per-chat selection)
  const activeWorkflow: WorkflowPresetMinimal | null = useMemo(() => {
    const wfList = getWorkflowPresets();
    const chat = getActiveChat();
    if (!chat || !chat.workflowId) return null;
    return wfList.find(w => w.id === chat.workflowId) || null;
  }, [workflowStoreVersion, chatStoreVersion]);

  const defaultMoePreset: MoeTeamPreset = useMemo(() => ({
    id: 'default-moe',
    name: 'Default MoE',
    mode: 'moe',
    stage1A: { roleId: 'stage1A', displayName: 'Stage1A', providerId: '', modelId: '' },
    stage1B: { roleId: 'stage1B', displayName: 'Stage1B', providerId: '', modelId: '' },
    stage2C: { roleId: 'stage2C', displayName: 'Stage2C', providerId: '', modelId: '' },
    stage2D: { roleId: 'stage2D', displayName: 'Stage2D', providerId: '', modelId: '' },
    summarizer: { roleId: 'summarizer', displayName: 'Summarizer', providerId: '', modelId: '' },
  }), []);

  const moePreset: MoeTeamPreset = useMemo(() => {
    return (activeTeam && activeTeam.mode === 'moe' ? (activeTeam as MoeTeamPreset) : defaultMoePreset);
  }, [activeTeam, defaultMoePreset]);

  const { isRunning: isMoeRunning, stepsState, startMoeProcessing, stopGenerating: stopMoeGenerating, resetMoeMemory, resetMoeState } = useMoeLogic({ 
    providersById, 
    preset: moePreset,
    notepadContent,
    onSummarizerReady: (sum) => {
      if (sum?.content) {
        const parsed = parseAIResponse(sum.content);
        processNotepadUpdateFromAI(parsed, MessageSender.Cognito, addMessage);
      } else if (sum?.errorMessage) {
        addMessage(`[system] Summarizer failure锟?{sum.errorMessage}`, MessageSender.System, MessagePurpose.SystemNotification);
      }
    }
  });
  
  // Reset MoE prev1 memory when API config mode toggles (align with initializeChat reinit effect)
  useEffect(() => {
    if (activeTeam && activeTeam.mode === 'moe') {
      resetMoeMemory();
    }
  }, [useCustomApiConfig, useOpenAiApiConfig, activeTeam, resetMoeMemory]);

  // Custom Workflow Orchestrator wiring
  const { isRunning: isWorkflowRunning, runWorkflow, stop: stopWorkflow } = useWorkflowOrchestrator({
    providers: appState.apiProviders,
    roleLibrary: getRoleLibrary(),
    workflow: activeWorkflow,
    getTranscript: () => [],
    setTranscript: (_t) => {},
    getFinalNotepadContent: () => notepadContent,
    getUserHistory: () => getActiveChatUserHistory(),
    appendNotepadSnapshot: (content, at) => {
      try { appendNotepadSnapshotToActiveChat(content, at); } catch {}
    },
    disableLegacyTranscript: true,
    onRoleDelta: ({ roundIndex, roleName, textDelta }) => {
      setCurrentWorkflowEvent(prev => {
        if (!prev) return prev;
        const next = { ...prev, rounds: prev.rounds.map(r => ({ steps: r.steps.map(s => ({ ...s })) })) } as typeof prev;
        const round = next.rounds[roundIndex];
        if (round) {
          const idx = round.steps.findIndex((s: any) => s.roleName === roleName);
          if (idx >= 0) {
            const cur = round.steps[idx] as any;
            cur.status = 'thinking';
            cur.content = (cur.content || '') + (textDelta || '');
          }
        }
        return next;
      });
    },
    onRoleOutput: (evt) => {
      setCurrentWorkflowEvent(prev => {
        if (!prev) return prev;
        const next = { ...prev, rounds: prev.rounds.map(r => ({ steps: r.steps.map(s => ({ ...s })) })) } as typeof prev;
        const round = next.rounds[evt.roundIndex];
        if (round) {
          const idx = round.steps.findIndex((s: any) => s.roleName === evt.roleName);
          if (idx >= 0) {
            if (evt.errorCode) {
              (round.steps[idx] as any).status = 'error';
              (round.steps[idx] as any).error = evt.errorMessage || String(evt.errorCode);
            } else {
              const text = evt.text || '';
              const parsed = parseAIResponse(text);
              processNotepadUpdateFromAI(parsed, MessageSender.System, addMessage);
              (round.steps[idx] as any).status = 'done';
              (round.steps[idx] as any).content = parsed.spokenText || text;
              try {
                const role = getRoleLibrary().find(r => r.name === evt.roleName);
                if (role) {
                  const prov = appState.apiProviders.find(p => p.id === role.providerId);
                  if (prov) {
                    (round.steps[idx] as any).brand = prov.brandKey as any;
                    (round.steps[idx] as any).iconUrl = prov.brandIconUrl;
                  }
                  // Show the role name instead of model id on the card
                  (round.steps[idx] as any).titleText = evt.roleName;
                }
              } catch {}
            }
          }
        }
        return next;
      });
    },
    onRoleMessagesPreview: ({ roundIndex, roleName, preview }) => {
      setCurrentWorkflowEvent(prev => {
        if (!prev) return prev;
        const next = { ...prev, rounds: prev.rounds.map(r => ({ steps: r.steps.map(s => ({ ...s })) })) } as typeof prev;
        const round = next.rounds[roundIndex];
        if (!round) return next;
        const idx = round.steps.findIndex((s: any) => s.roleName === roleName);
        if (idx >= 0) {
          (round.steps[idx] as any).debugPreview = preview;
        }
        return next;
      });
    },
    onStreamingFallback: ({ roundIndex, roleName, message }) => {
      try {
        const note = message || `Streaming not available for role '${roleName}', falling back to non-streaming.`;
        addMessage(`[workflow] ${note}`, MessageSender.System, MessagePurpose.SystemNotification);
      } catch {}
    },
    
    enableStreaming: streamingEnabled,
    streamIntervalMs: streamIntervalMs,
  });

  // When active chat changes, clear live UI and restore from persisted chat state
  useEffect(() => {
    try {
      const curId = getActiveChatId();
      if (lastChatIdRef.current === null) {
        lastChatIdRef.current = curId;
        return;
      }
      if (curId !== lastChatIdRef.current) {
        lastChatIdRef.current = curId;
        // Stop any ongoing generation
        try { stopWorkflow(); } catch {}
        try { stopMoeGenerating(); } catch {}
        try { stopChatLogicGeneration(); } catch {}
        // Reset UI states and restore from persisted chat
        const active = getActiveChat();
        // Messages timeline
        setMessages(active && active.messages ? active.messages : []);
        // Live workflow bubble should be empty on switch
        setCurrentWorkflowEvent(null);
        // Restore archived workflow runs from persisted structure
        try {
          const runs = (active as any)?.workflowRuns as any[] | undefined;
          if (Array.isArray(runs) && runs.length) {
            const restored = runs.map(r => ({
              id: r.id,
              startedAt: typeof r.startedAt === 'number' ? r.startedAt : Date.now(),
              anchorMessageId: '',
              name: typeof r.name === 'string' ? r.name : 'Workflow',
              rounds: (Array.isArray(r.rounds) ? r.rounds : []).map((rd: any) => ({
                steps: (Array.isArray(rd.steps) ? rd.steps : []).map((s: any) => ({
                  roleName: String(s.roleName || ''),
                  titleText: String(s.roleName || ''),
                  brand: s.brand as any,
                  iconUrl: s.iconUrl as any,
                  status: (s.status === 'done' || s.status === 'error') ? s.status : 'thinking',
                  content: typeof s.content === 'string' ? s.content : undefined,
                  error: typeof s.error === 'string' ? s.error : undefined,
                }))
              })) as any,
            }));
            setWorkflowRunHistory(restored as any);
          } else {
            setWorkflowRunHistory([]);
          }
        } catch {
          setWorkflowRunHistory([]);
        }
        setCurrentMoeEvent(null);
        setMoeRunHistory([]);
        // Restore Canvas: prefer notepadCurrent, fallback to last snapshot
        try {
          const nc = (active as any)?.notepadCurrent;
          if (typeof nc === 'string' && nc.length > 0) {
            applyUserEdit(nc);
          } else {
            const lastSnap = active && active.notepadSnapshots && active.notepadSnapshots.length
              ? active.notepadSnapshots[active.notepadSnapshots.length - 1]
              : null;
            if (lastSnap && typeof lastSnap.content === 'string') {
              applyUserEdit(lastSnap.content);
            } else {
              clearNotepadContent();
            }
          }
        } catch { clearNotepadContent(); }
        setIsNotepadFullscreen(false);
      }
    } catch {}
  }, [chatStoreVersion, stopWorkflow, stopMoeGenerating, stopChatLogicGeneration, clearNotepadContent, setIsNotepadFullscreen, applyUserEdit]);

  const onSendMessageUnified = useCallback(async (message: string, imageFile?: File | null) => {
    // If custom workflow is active, run it and bypass legacy flows
    if (activeWorkflow && activeWorkflow.rounds && activeWorkflow.rounds.length > 0) {
      // Archive previous workflow bubble before starting a new run to preserve 1:1 chat layout
      setWorkflowRunHistory(prev => (currentWorkflowEvent ? [...prev, { id: currentWorkflowEvent.runId, rounds: currentWorkflowEvent.rounds, startedAt: currentWorkflowEvent.startedAt, anchorMessageId: currentWorkflowEvent.anchorMessageId, name: currentWorkflowEvent.name }] : prev));
      let userMsgId = '';
      flushSync(() => {
        userMsgId = addMessage(message, MessageSender.User, MessagePurpose.UserInput);
      });
      // Persist occurs via addMessage -> centralized hook (avoid double)
      const lib = getRoleLibrary();
      const libByName = lib.reduce((acc, it) => { acc[it.name] = it; return acc; }, {} as Record<string, any>);
      const rounds = (activeWorkflow.rounds || []).map(r => ({
        steps: (r.roles || []).slice(0, 4).map((roleName: string) => {
          const roleCfg = libByName[roleName];
          const prov = roleCfg ? providersById[roleCfg.providerId] : undefined;
          return {
            roleName,
            status: 'thinking',
            titleText: roleName,
            brand: prov?.brandKey as any,
            iconUrl: prov?.brandIconUrl,
          };
        })
      })) as any;
      const newRunId = generateUniqueId();
      setCurrentWorkflowEvent({ runId: newRunId, startedAt: Date.now(), anchorMessageId: userMsgId, rounds, name: activeWorkflow.name || 'Workflow' });
      runWorkflow(message);
      return;
    }
    if (activeTeam && activeTeam.mode === 'moe') {
      // Before starting a new MoE run, snapshot previous run (if any final results exist)
      try {
        const anyFinal = stepsState && Object.values(stepsState).some((s: any) => s && (s.status === 'done' || s.status === 'error'));
        if (!isMoeRunning && anyFinal && currentMoeEvent) {
          const snapshot: Record<MoaStepId, MoaStepResult> = JSON.parse(JSON.stringify(stepsState));
          setMoeRunHistory(prev => [...prev, { id: currentMoeEvent.runId, steps: snapshot, startedAt: currentMoeEvent.startedAt, anchorMessageId: currentMoeEvent.anchorMessageId }]);
        }
      } catch {}
      // Insert user message first (with optional image metadata), then start MoE processing
      let imageApiPart: { inlineData: { mimeType: string; data: string } } | undefined;
      let userImageForDisplay: ChatMessage['image'] | undefined;
      let userMsgId: string;
      if (imageFile) {

        const dataUrl = URL.createObjectURL(imageFile);
        userImageForDisplay = { dataUrl, name: imageFile.name, type: imageFile.type };
        flushSync(() => {
          userMsgId = addMessage(message, MessageSender.User, MessagePurpose.UserInput, undefined, userImageForDisplay!);
        });
        const data = await fileToBase64(imageFile);
        imageApiPart = { inlineData: { mimeType: imageFile.type, data } };
      } else {
        flushSync(() => {
          userMsgId = addMessage(message, MessageSender.User, MessagePurpose.UserInput);
        });
      }
      // anchor current live MoE bubble to this user message
      const newRunId = generateUniqueId();
      setCurrentMoeEvent({ runId: newRunId, startedAt: Date.now(), anchorMessageId: userMsgId });
      await startMoeProcessing(message, imageApiPart);
      return;
    }
    startChatProcessing(message, imageFile || undefined);
  }, [activeWorkflow, workflowStoreVersion, activeTeam, startMoeProcessing, startChatProcessing, addMessage, stepsState, isMoeRunning, setMoeRunHistory, currentMoeEvent, currentWorkflowEvent, setWorkflowRunHistory, providersById]);

  const uiIsLoading = activeWorkflow ? isWorkflowRunning : (activeTeam && activeTeam.mode === 'moe' ? isMoeRunning : isLoading);

  const handleStopGeneratingUnified = useCallback(() => {
    if (activeWorkflow) {
      stopWorkflow();
      // Archive current live workflow bubble into history (UI only); persisted rounds remain in chat store
      setWorkflowRunHistory(prev => (currentWorkflowEvent ? [...prev, { id: currentWorkflowEvent.runId, rounds: currentWorkflowEvent.rounds, startedAt: currentWorkflowEvent.startedAt, anchorMessageId: currentWorkflowEvent.anchorMessageId, name: currentWorkflowEvent.name }] : prev));
      setCurrentWorkflowEvent(null);
      addMessage('Cancel Request', MessageSender.System, MessagePurpose.Cancelled);
      return;
    }
    if (activeTeam && activeTeam.mode === 'moe') {
      // Immediately drop live bubble and clear step state, then stop engine
      setCurrentMoeEvent(null);
      try { resetMoeState(); } catch {}
      stopMoeGenerating();
      // Also add a cancel notice for clear feedback
      addMessage('Cancel Request', MessageSender.System, MessagePurpose.Cancelled);
    } else {
      stopChatLogicGeneration();
      // Remove the current AI bubble and placeholders, then add an immediate cancel notice
      removeLatestAiBubble();
      prunePendingSystemPlaceholders();
      addMessage('Cancel Request', MessageSender.System, MessagePurpose.Cancelled);
    }
  }, [activeWorkflow, stopWorkflow, activeTeam, stopMoeGenerating, stopChatLogicGeneration, prunePendingSystemPlaceholders, removeLatestAiBubble, addMessage, setCurrentMoeEvent]);

  const showMoeBubble = useMemo(() => {
    if (!(activeTeam && activeTeam.mode === 'moe')) return false;
    if (isMoeRunning) return true;
    try {
      const anyFinal = stepsState && Object.values(stepsState as any).some((s: any) => s && (s.status === 'done' || s.status === 'error'));
      return !!anyFinal;
    } catch (e) {
      return false;
    }
  }, [activeTeam, isMoeRunning, stepsState]);

  const modelSelectorBaseClass = "bg-white border border-gray-400 text-gray-800 text-sm rounded-md p-1.5 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none disabled:opacity-70 disabled:cursor-not-allowed";
  const modelSelectorWidthClass = "w-40 md:w-44"; 

  const handleUseCustomGeminiApiConfigChange = () => {
    if (!isLoading) {
      const newValue = !useCustomApiConfig;
      setUseCustomApiConfig(newValue);
      if (newValue && useOpenAiApiConfig) { 
        setUseOpenAiApiConfig(false);      
      }
    }
  };

  const handleUseOpenAiApiConfigChange = () => {
    if (!isLoading) {
      const newValue = !useOpenAiApiConfig;
      setUseOpenAiApiConfig(newValue);
      if (newValue && useCustomApiConfig) { 
        setUseCustomApiConfig(false);       
      }
    }
  };


  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  return (
    <>
      {/* Sidebar + mobile toggle */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(v => !v)}
        isCollapsed={isSidebarCollapsed}
        onCollapseToggle={() => setIsSidebarCollapsed(v => !v)}
        onOpenSettings={openSettingsModal}
      />
      {!isSidebarOpen && (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="fixed left-2 top-2 z-30 p-2 rounded md:hidden bg-white border border-gray-300 text-gray-700 shadow"
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          {/* simple icon substitute */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2"/><line x1="9" y1="5" x2="9" y2="19" stroke="currentColor" strokeWidth="2"/></svg>
        </button>
      )}
      <div className={`flex flex-col h-screen bg-white shadow-2xl overflow-hidden ${isNotepadFullscreen ? 'fixed inset-0 z-40' : 'relative'} ${isSidebarCollapsed ? 'md:pl-12' : 'md:pl-[260px]'}`}>
      {/* header removed per new design */}
        

        {/*
          {false && (
            <>
              {useOpenAiApiConfig ? (
                <>
                  <div className="flex items-center p-1.5 bg-indigo-50 border border-indigo-300 rounded-md" title={`OpenAI Cognito: ${openAiCognitoModelId || '閺堫亝瀵氶敓?}`}>
                    <Brain size={18} className="mr-1.5 text-indigo-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-indigo-700 whitespace-nowrap hidden sm:inline">Cognito:</span>
                    <span className="text-sm font-medium text-indigo-700 whitespace-nowrap ml-1 sm:ml-0">{openAiCognitoModelId || '閺堫亝瀵氶敓?}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center p-1.5 bg-purple-50 border border-purple-300 rounded-md" title={`OpenAI Muse: ${openAiMuseModelId || '閺堫亝瀵氶敓?}`}>
                    <Sparkles size={18} className="mr-1.5 text-purple-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-purple-700 whitespace-nowrap hidden sm:inline">Muse:</span>
                    <span className="text-sm font-medium text-purple-700 whitespace-nowrap ml-1 sm:ml-0">{openAiMuseModelId || '閺堫亝瀵氶敓?}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center" title={`Cognito Model: ${actualCognitoModelDetails.name}`}>
                    <label htmlFor="cognitoModelSelector" className="sr-only">Cognito AI 濡€筹拷?/label>
                    <Brain size={18} className="mr-1.5 text-green-600 flex-shrink-0" aria-hidden="true" />
                    <span className="text-sm font-medium text-gray-700 mr-1 hidden sm:inline">Cognito:</span>
                    <select 
                      id="cognitoModelSelector" 
                      value={selectedCognitoModelApiName} 
                      onChange={(e) => setSelectedCognitoModelApiName(e.target.value)}
                      className={`${modelSelectorBaseClass} ${modelSelectorWidthClass}`}
                      aria-label="闁瀚–ognito閻ㄥ嚈I濡€筹拷? 
                      disabled={uiIsLoading || useOpenAiApiConfig}>
                      {MODELS.map((model) => (<option key={`cognito-${model.id}`} value={model.apiName}>{model.name}</option>))}
                    </select>
                  </div>
                  <Separator />
                  <div className="flex items-center" title={`Muse Model: ${actualMuseModelDetails.name}`}>
                    <label htmlFor="museModelSelector" className="sr-only">Muse AI 濡€筹拷?/label>
                    <Sparkles size={18} className="mr-1.5 text-purple-600 flex-shrink-0" aria-hidden="true" />
                    <span className="text-sm font-medium text-gray-700 mr-1 hidden sm:inline">Muse:</span>
                    <select 
                      id="museModelSelector" 
                      value={selectedMuseModelApiName} 
                      onChange={(e) => setSelectedMuseModelApiName(e.target.value)}
                      className={`${modelSelectorBaseClass} ${modelSelectorWidthClass}`}
                      aria-label="闁瀚∕use閻ㄥ嚈I濡€筹拷? 
                      disabled={uiIsLoading || useOpenAiApiConfig}>
                      {MODELS.map((model) => (<option key={`muse-${model.id}`} value={model.apiName}>{model.name}</option>))}
                    </select>
                  </div>
                </>
              )}
              <Separator />
            </>
          )}
          <button onClick={openTeamModal}
            className="p-1.5 md:p-2 text-gray-500 hover:text-sky-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-gray-50 rounded-md shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
            aria-label="閹垫挸绱戦崶銏ゆЕ缁狅紕锟? title="閹垫挸绱戦崶銏ゆЕ缁狅紕锟? disabled={uiIsLoading}>
            <Database size={20} />
          </button>
          <button onClick={openSettingsModal}
            className="p-1.5 md:p-2 text-gray-500 hover:text-sky-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-gray-50 rounded-md shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
            aria-label="閹垫挸绱戠拋鍓х枂" title="閹垫挸绱戠拋鍓х枂" disabled={uiIsLoading}>
            <Settings2 size={20} /> 
          </button>
          <button onClick={handleClearChat}
            className="p-1.5 md:p-2 text-gray-500 hover:text-sky-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-gray-50 rounded-md shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
            aria-label="濞撳懐鈹栨导姘崇樈" title="濞撳懐鈹栨导姘崇樈" disabled={uiIsLoading}
            ><RefreshCwIcon size={20} /> 
          </button>
        </div>
        */}

      <div ref={panelsContainerRef} className={`flex flex-row flex-grow overflow-hidden ${isNotepadFullscreen ? 'relative' : ''}`}>
        {!isNotepadFullscreen && (
          <div
            id="chat-panel-wrapper"
            className="flex flex-col h-full overflow-hidden"
            style={{ width: `${chatPanelWidthPercent}%` }}
          >
            <div className="flex flex-col flex-grow h-full"> 
              {/* Workflow selector aligned to top of chat panel only */}
              <div className="px-3 pt-2 pb-2">
                <WorkflowSelector />
              </div>
              <div 
                ref={chatContainerRef} 
                className="flex-grow p-4 space-y-4 overflow-y-auto bg-white scroll-smooth chat-scrollbar"
                onScroll={handleChatScroll}
              >
                {
                  // Build interleaved timeline by timestamp
                  (() => {
                    type Item =
                      | { type: 'msg'; time: number; key: string; msg: ChatMessage }
                      | { type: 'moe'; time: number; key: string; steps: Record<MoaStepId, MoaStepResult> }
                      | { type: 'workflow'; time: number; key: string; rounds: any; title?: string };
                    const items: Item[] = [];
                    for (const m of messages) {
                      items.push({ type: 'msg', time: (m.timestamp instanceof Date ? m.timestamp.getTime() : new Date(m.timestamp as any).getTime()), key: `msg-${m.id}` , msg: m });
                    }
                    if (!activeWorkflow) {
                      for (const run of moeRunHistory) {
                        items.push({ type: 'moe', time: run.startedAt, key: `moe-hist-${run.id}`, steps: run.steps });
                      }
                      // Only render live MoE bubble while actually running
                      if (currentMoeEvent && isMoeRunning) {
                        items.push({ type: 'moe', time: currentMoeEvent.startedAt, key: `moe-live-${currentMoeEvent.runId}`, steps: stepsState as Record<MoaStepId, MoaStepResult> });
                      }
                    }
                    if (currentWorkflowEvent) {
                      items.push({ type: 'workflow', time: currentWorkflowEvent.startedAt, key: `wf-live-${currentWorkflowEvent.runId}`, rounds: currentWorkflowEvent.rounds, title: currentWorkflowEvent.name });
                    }
                    // Include workflow history runs (archived)
                    for (const run of workflowRunHistory) {
                      items.push({ type: 'workflow', time: run.startedAt, key: `wf-hist-${run.id}`, rounds: run.rounds, title: run.name });
                    }
                    items.sort((a, b) => a.time - b.time);
                    return items.map(it => {
                      if (it.type === 'msg') {
                        const msg = it.msg;
                        return (
                          <MessageBubble
                            key={it.key}
                            message={msg}
                            failedStepPayloadForThisMessage={failedStepInfo && msg.id === failedStepInfo.originalSystemErrorMsgId ? failedStepInfo : null}
                            onManualRetry={retryFailedStep}
                          />
                        );
                      }
                      if (it.type === 'moe') return <MoaBubble key={it.key} steps={it.steps} preset={moePreset} providersById={providersById} />;
                      if (it.type === 'workflow') return <WorkflowBubble key={it.key} rounds={it.rounds} title={it.title} showDebug={showWorkflowDebug} showTypingCaret={typingCaretEnabled} />;
                      return null;
                    });
                  })()
                }
              </div>
              <ChatInput
                onSendMessage={onSendMessageUnified}
                isLoading={uiIsLoading}
                isApiKeyMissing={apiKeyStatus.isMissing || apiKeyStatus.isInvalid || false}
                onStopGenerating={handleStopGeneratingUnified}
              />

            </div>
          </div>
        )}

        {!isNotepadFullscreen && (
          <div
            id="panel-resizer"
            className="w-px h-full bg-gray-100 hover:bg-gray-200 rounded-full cursor-col-resize select-none shrink-0 transition-colors duration-150 ease-in-out focus:outline-none focus:ring-0"
            onMouseDown={handleMouseDownOnResizer}
            onKeyDown={handleResizerKeyDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="Drag to resize chat and canvas"
            aria-controls="chat-panel-wrapper notepad-panel-wrapper"
            aria-valuenow={chatPanelWidthPercent}
            aria-valuemin={20} 
            aria-valuemax={80} 
            tabIndex={0}
            title="Drag to resize chat and notepad"
          />
        )}
        
        <div
          id="notepad-panel-wrapper"
          className={`h-full bg-white flex flex-col ${
            isNotepadFullscreen 
            ? 'fixed inset-0 z-50 w-screen' 
            : 'overflow-hidden'
          }`}
          style={!isNotepadFullscreen ? { width: `${100 - chatPanelWidthPercent}%` } : {}}
        >
          <Notepad 
            content={notepadContent} 
            lastUpdatedBy={lastNotepadUpdateBy} 
            isLoading={uiIsLoading} 
            isNotepadFullscreen={isNotepadFullscreen}
            onToggleFullscreen={toggleNotepadFullscreen}
            onClearChat={handleClearChat}
            onEdit={applyUserEdit}
            onUndo={undoNotepad}
            onRedo={redoNotepad}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </div>
      </div>

       {(apiKeyStatus.isMissing || apiKeyStatus.isInvalid) && apiKeyBannerMessage &&
        !isNotepadFullscreen &&
        (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 p-3 bg-red-100 text-red-700 border border-red-300 rounded-lg shadow-lg flex items-center text-sm z-50 max-w-md text-center">
            <AlertTriangle size={20} className="mr-2 shrink-0" /> {apiKeyBannerMessage}
        </div>
      )}
      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={closeSettingsModal}
          onOpenRoleLibrary={openTeamModal}
          onOpenWorkflowEditor={openWorkflowModal}
          discussionMode={discussionMode}
          onDiscussionModeChange={(mode) => setDiscussionMode(mode)}
          manualFixedTurns={manualFixedTurns}
          onManualFixedTurnsChange={(e) => {
            let value = parseInt(e.target.value, 10);
            if (isNaN(value)) value = DEFAULT_MANUAL_FIXED_TURNS;
            value = Math.max(MIN_MANUAL_FIXED_TURNS, value); 
            setManualFixedTurns(value);
          }}
          minManualFixedTurns={MIN_MANUAL_FIXED_TURNS}
          isThinkingBudgetActive={isThinkingBudgetActive}
          onThinkingBudgetToggle={() => setIsThinkingBudgetActive(prev => !prev)}
          supportsThinkingConfig={actualCognitoModelDetails.supportsThinkingConfig || actualMuseModelDetails.supportsThinkingConfig} 
          cognitoSystemPrompt={cognitoSystemPrompt}
          onCognitoPromptChange={(e) => setCognitoSystemPrompt(e.target.value)}
          onResetCognitoPrompt={() => setCognitoSystemPrompt(COGNITO_SYSTEM_PROMPT_HEADER)}
          museSystemPrompt={museSystemPrompt}
          onMusePromptChange={(e) => setMuseSystemPrompt(e.target.value)}
          onResetMusePrompt={() => setMuseSystemPrompt(MUSE_SYSTEM_PROMPT_HEADER)}
          supportsSystemInstruction={actualCognitoModelDetails.supportsSystemInstruction || actualMuseModelDetails.supportsSystemInstruction} 
          isLoading={isLoading}
          fontSizeScale={fontSizeScale}
          onFontSizeScaleChange={setFontSizeScale}
          theme={theme}
          onThemeChange={setTheme}
          streamingEnabled={streamingEnabled}
          onStreamingEnabledToggle={() => setStreamingEnabled(prev => !prev)}
          streamIntervalMs={streamIntervalMs}
          onStreamIntervalChange={(ms) => setStreamIntervalMs(ms)}
          typingCaretEnabled={typingCaretEnabled}
          onTypingCaretToggle={() => setTypingCaretEnabled(prev => !prev)}
          showWorkflowDebug={showWorkflowDebug}
          onWorkflowDebugToggle={() => setShowWorkflowDebug(prev => !prev)}
          // Gemini Custom API Props
          useCustomApiConfig={useCustomApiConfig}
          onUseCustomApiConfigChange={handleUseCustomGeminiApiConfigChange}
          customApiEndpoint={customApiEndpoint}
          onCustomApiEndpointChange={(e) => setCustomApiEndpoint(e.target.value)}
          customApiKey={customApiKey}
          onCustomApiKeyChange={(e) => setCustomApiKey(e.target.value)}
          // OpenAI Custom API Props
          useOpenAiApiConfig={useOpenAiApiConfig}
          onUseOpenAiApiConfigChange={handleUseOpenAiApiConfigChange}
          openAiApiBaseUrl={openAiApiBaseUrl}
          onOpenAiApiBaseUrlChange={(e) => setOpenAiApiBaseUrl(e.target.value)}
          openAiApiKey={openAiApiKey}
          onOpenAiApiKeyChange={(e) => setOpenAiApiKey(e.target.value)}
          openAiCognitoModelId={openAiCognitoModelId}
          onOpenAiCognitoModelIdChange={(e) => setOpenAiCognitoModelId(e.target.value)}
          openAiMuseModelId={openAiMuseModelId}
          onOpenAiMuseModelIdChange={(e) => setOpenAiMuseModelId(e.target.value)}
        />
      )}
      {isRoleLibraryOpen && (
        <RoleLibraryModal isOpen={isRoleLibraryOpen} onClose={closeTeamModal} initialSelectedName={roleEditorPreselectName || undefined} />
      )}
      {isWorkflowEditorOpen && (
        <WorkflowEditorModal isOpen={isWorkflowEditorOpen} onClose={closeWorkflowModal} />
      )}
      </div>
    </>
  );
};

export default App;
