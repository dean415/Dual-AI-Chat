import { ApiProviderConfig, DiscussionMode, DiscussionTeamPreset, MoeTeamPreset, TeamPreset, BrandKey, Chat, ChatMessage, MessageSender, MessagePurpose } from '../types';
import {
  COGNITO_SYSTEM_PROMPT_HEADER,
  MUSE_SYSTEM_PROMPT_HEADER,
  DEFAULT_COGNITO_MODEL_API_NAME,
  DEFAULT_MUSE_MODEL_API_NAME,
  DEFAULT_MANUAL_FIXED_TURNS,
  // Legacy keys for migration
  USE_CUSTOM_API_CONFIG_STORAGE_KEY,
  CUSTOM_API_ENDPOINT_STORAGE_KEY,
  CUSTOM_API_KEY_STORAGE_KEY,
  USE_OPENAI_API_CONFIG_STORAGE_KEY,
  OPENAI_API_BASE_URL_STORAGE_KEY,
  OPENAI_API_KEY_STORAGE_KEY,
  OPENAI_COGNITO_MODEL_ID_STORAGE_KEY,
  OPENAI_MUSE_MODEL_ID_STORAGE_KEY,
  DEFAULT_OPENAI_API_BASE_URL,
  DEFAULT_OPENAI_COGNITO_MODEL_ID,
  DEFAULT_OPENAI_MUSE_MODEL_ID,
} from '../constants';
import { generateUniqueId } from './appUtils';

// Centralized storage keys and schema versioning
export const STORAGE_KEYS = {
  schemaVersion: 'dualAiChat.schemaVersion',
  apiProviders: 'dualAiChat.apiProviders',
  teamPresets: 'dualAiChat.teamPresets',
  activeTeamId: 'dualAiChat.activeTeamId',
  // New keys for custom workflow
  roleLibrary: 'dualAiChat.roleLibrary',
  workflowPresets: 'dualAiChat.workflowPresets',
  activeWorkflowId: 'dualAiChat.activeWorkflowId',
  transcript: 'dualAiChat.transcript',
  // New keys for per-chat storage (v4)
  chats: 'dualAiChat.chats',
  activeChatId: 'dualAiChat.activeChatId',
  // Streaming preferences
  streamingEnabled: 'dualAiChat.streaming.enabled',
  streamingIntervalMs: 'dualAiChat.streaming.intervalMs',
} as const;

export const SCHEMA_VERSION = 6;

// Throttled localStorage writes
type SaveQueueItem = { key: string; value: any };
let pending: Record<string, SaveQueueItem> = {};
let flushTimer: number | null = null;
const FLUSH_INTERVAL_MS = 300;

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T) {
  pending[key] = { key, value };
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    const items = Object.values(pending);
    pending = {};
    flushTimer = null;
    for (const item of items) {
      try {
        localStorage.setItem(item.key, JSON.stringify(item.value));
      } catch (e) {
        console.error('localStorage save failed for', item.key, e);
      }
    }
  }, FLUSH_INTERVAL_MS);
}

export interface EnsureSchemaResult {
  apiProviders: ApiProviderConfig[];
  teamPresets: TeamPreset[];
  activeTeamId: string;
  schemaVersion: number;
}

export function ensureSchemaAndMigrate(): EnsureSchemaResult {
  // If already on current version, just load and return
  const existingVersion = load<number | null>(STORAGE_KEYS.schemaVersion, null);
  if (existingVersion === SCHEMA_VERSION) {
    const apiProviders = load<ApiProviderConfig[]>(STORAGE_KEYS.apiProviders, []);
    const teamPresets = load<TeamPreset[]>(STORAGE_KEYS.teamPresets, []);
    const activeTeamId = load<string | null>(STORAGE_KEYS.activeTeamId, teamPresets[0]?.id || null) || (teamPresets[0]?.id ?? '');
    // Ensure new keys exist with sane defaults (idempotent)
    try { if (localStorage.getItem(STORAGE_KEYS.roleLibrary) === null) save(STORAGE_KEYS.roleLibrary, []); } catch {}
    try { if (localStorage.getItem(STORAGE_KEYS.workflowPresets) === null) save(STORAGE_KEYS.workflowPresets, []); } catch {}
    try { if (localStorage.getItem(STORAGE_KEYS.activeWorkflowId) === null) save(STORAGE_KEYS.activeWorkflowId, ''); } catch {}
    try { if (localStorage.getItem(STORAGE_KEYS.transcript) === null) save(STORAGE_KEYS.transcript, []); } catch {}
    try { if (localStorage.getItem(STORAGE_KEYS.chats) === null) save(STORAGE_KEYS.chats, []); } catch {}
    try { if (localStorage.getItem(STORAGE_KEYS.activeChatId) === null) save(STORAGE_KEYS.activeChatId, ''); } catch {}
    // Ensure streaming defaults
    try { if (localStorage.getItem(STORAGE_KEYS.streamingEnabled) === null) save(STORAGE_KEYS.streamingEnabled, true); } catch {}
    try { if (localStorage.getItem(STORAGE_KEYS.streamingIntervalMs) === null) save(STORAGE_KEYS.streamingIntervalMs, 30); } catch {}
    // Ensure per-role streamingEnabled default true in roleLibrary (idempotent)
    try {
      const lib = load<any[]>(STORAGE_KEYS.roleLibrary, []);
      if (Array.isArray(lib) && lib.length) {
        const patched = lib.map(r => ({ ...r, streamingEnabled: (typeof r?.streamingEnabled === 'boolean') ? r.streamingEnabled : true }));
        save(STORAGE_KEYS.roleLibrary, patched);
      }
    } catch {}
    return { apiProviders, teamPresets, activeTeamId, schemaVersion: SCHEMA_VERSION };
  }

  // Upgrade path: v5 -> v6 (add per-role streamingEnabled default true)
  if (existingVersion === 5) {
    const apiProviders = load<ApiProviderConfig[]>(STORAGE_KEYS.apiProviders, []);
    const teamPresets = load<TeamPreset[]>(STORAGE_KEYS.teamPresets, []);
    const activeTeamId = load<string | null>(STORAGE_KEYS.activeTeamId, teamPresets[0]?.id || null) || (teamPresets[0]?.id ?? '');
    // Patch roleLibrary entries
    try {
      const lib = load<any[]>(STORAGE_KEYS.roleLibrary, []);
      if (Array.isArray(lib) && lib.length) {
        const patched = lib.map(r => ({ ...r, streamingEnabled: (typeof r?.streamingEnabled === 'boolean') ? r.streamingEnabled : true }));
        save(STORAGE_KEYS.roleLibrary, patched);
      }
    } catch {}
    // Patch team presets roles
    const fixRole = (r: any) => ({ ...r, streamingEnabled: (typeof r?.streamingEnabled === 'boolean') ? r.streamingEnabled : true });
    const patchedTeams = (teamPresets || []).map(t => {
      if (!t || typeof t !== 'object') return t;
      if ((t as any).mode === 'discussion') {
        const d = t as any;
        return { ...d, cognito: fixRole(d.cognito), muse: fixRole(d.muse) };
      }
      if ((t as any).mode === 'moe') {
        const m = t as any;
        return { ...m, stage1A: fixRole(m.stage1A), stage1B: fixRole(m.stage1B), stage2C: fixRole(m.stage2C), stage2D: fixRole(m.stage2D), summarizer: fixRole(m.summarizer) };
      }
      return t;
    }) as TeamPreset[];
    save(STORAGE_KEYS.teamPresets, patchedTeams);
    save(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);
    return { apiProviders, teamPresets: patchedTeams, activeTeamId, schemaVersion: SCHEMA_VERSION };
  }

  // Upgrade path: v4 -> v5 (add per-chat workflowRuns[] and notepadCurrent defaults)
  if (existingVersion === 4) {
    const apiProviders = load<ApiProviderConfig[]>(STORAGE_KEYS.apiProviders, []);
    const teamPresets = load<TeamPreset[]>(STORAGE_KEYS.teamPresets, []);
    const activeTeamId = load<string | null>(STORAGE_KEYS.activeTeamId, teamPresets[0]?.id || null) || (teamPresets[0]?.id ?? '');
    // Ensure chats exist and patch missing fields
    let chats = load<Chat[]>(STORAGE_KEYS.chats, []);
    if (Array.isArray(chats) && chats.length) {
      chats = chats.map((c: any) => ({
        ...c,
        workflowRuns: Array.isArray(c?.workflowRuns) ? c.workflowRuns : [],
        notepadCurrent: typeof c?.notepadCurrent === 'string' ? c.notepadCurrent : '',
      }));
      save(STORAGE_KEYS.chats, chats);
    } else {
      // If no chats yet, just ensure keys exist; Step 1/ensureInitialChat will handle creation
      save(STORAGE_KEYS.chats, chats || []);
    }
    // Keep activeChatId as-is
    const activeChatId = load<string>(STORAGE_KEYS.activeChatId, '');
    if (typeof activeChatId !== 'string') save(STORAGE_KEYS.activeChatId, '');
    // Bump version
    save(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);
    return { apiProviders, teamPresets, activeTeamId, schemaVersion: SCHEMA_VERSION };
  }

  // Upgrade path: v3 -> v4 (introduce chats/activeChatId; keep legacy transcript for now)
  if (existingVersion === 3) {
    const apiProviders = load<ApiProviderConfig[]>(STORAGE_KEYS.apiProviders, []);
    const teamPresets = load<TeamPreset[]>(STORAGE_KEYS.teamPresets, []);
    const activeTeamId = load<string | null>(STORAGE_KEYS.activeTeamId, teamPresets[0]?.id || null) || (teamPresets[0]?.id ?? '');
    // Initialize new chat keys
    let chats = load<Chat[]>(STORAGE_KEYS.chats, []);
    let activeChatId = load<string>(STORAGE_KEYS.activeChatId, '');
    if (chats.length === 0) {
      // Try to wrap legacy transcript into the first chat
      const transcript = load<any[]>(STORAGE_KEYS.transcript, []);
      const now = Date.now();
      const firstId = 'chat-' + generateUniqueId();
      const messages: ChatMessage[] = [];
      const snapshots: { at: number; content: string }[] = [];
      try {
        for (const t of transcript) {
          if (!t || typeof t !== 'object') continue;
          if (t.role === 'user' && typeof t.content === 'string') {
            messages.push({
              id: generateUniqueId(),
              text: t.content,
              sender: MessageSender.User,
              purpose: MessagePurpose.UserInput,
              timestamp: new Date(typeof t.at === 'number' ? t.at : now),
            } as ChatMessage);
          } else if (t.role === 'assistant_notepad' && typeof t.content === 'string') {
            snapshots.push({ at: (typeof t.at === 'number' ? t.at : now), content: t.content });
          }
        }
      } catch {}
      const createdAt = messages.length ? (messages[0].timestamp as any as Date).getTime?.() || now : now;
      const updatedAt = (transcript.length ? (typeof transcript[transcript.length-1]?.at === 'number' ? transcript[transcript.length-1].at : now) : now);
      const chat: Chat = {
        id: firstId,
        title: 'New Chat',
        createdAt,
        updatedAt,
        messages,
        notepadSnapshots: snapshots,
      } as Chat;
      chats = [chat];
      activeChatId = firstId;
      save(STORAGE_KEYS.chats, chats);
      save(STORAGE_KEYS.activeChatId, activeChatId);
    } else {
      // Ensure active id exists
      if (!activeChatId) {
        activeChatId = chats[0].id;
        save(STORAGE_KEYS.activeChatId, activeChatId);
      }
    }
    save(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);
    return { apiProviders, teamPresets, activeTeamId, schemaVersion: SCHEMA_VERSION };
  }

  // Upgrade path: v2 -> v3 (introduce roleLibrary/workflowPresets/transcript)
  if (existingVersion === 2) {
    const apiProviders = load<ApiProviderConfig[]>(STORAGE_KEYS.apiProviders, []);
    const teamPresets = load<TeamPreset[]>(STORAGE_KEYS.teamPresets, []);
    const activeTeamId = load<string | null>(STORAGE_KEYS.activeTeamId, teamPresets[0]?.id || null) || (teamPresets[0]?.id ?? '');
    // Initialize new keys
    save(STORAGE_KEYS.roleLibrary, load(STORAGE_KEYS.roleLibrary, [] as any[]));
    save(STORAGE_KEYS.workflowPresets, load(STORAGE_KEYS.workflowPresets, [] as any[]));
    save(STORAGE_KEYS.activeWorkflowId, load(STORAGE_KEYS.activeWorkflowId, ''));
    save(STORAGE_KEYS.transcript, load(STORAGE_KEYS.transcript, [] as any[]));
    // Also initialize chats keys for forward-compatibility
    save(STORAGE_KEYS.chats, load(STORAGE_KEYS.chats, [] as any[]));
    save(STORAGE_KEYS.activeChatId, load(STORAGE_KEYS.activeChatId, ''));
    save(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);
    return { apiProviders, teamPresets, activeTeamId, schemaVersion: SCHEMA_VERSION };
  }

  // Upgrade path: v1 -> v2 (introduce brandKey for providers)
  if (existingVersion === 1) {
    const loadedProviders = load<ApiProviderConfig[]>(STORAGE_KEYS.apiProviders, []);
    const loadedTeams = load<TeamPreset[]>(STORAGE_KEYS.teamPresets, []);
    const loadedActiveTeamId = load<string | null>(STORAGE_KEYS.activeTeamId, loadedTeams[0]?.id || null) || (loadedTeams[0]?.id ?? '');
    const withBrand: ApiProviderConfig[] = loadedProviders.map(p => ({
      ...p,
      brandKey: (p.brandKey || ((p.providerType === 'openai') ? 'gpt' : (p.providerType === 'gemini') ? 'gemini' : 'generic')) as BrandKey,
    }));
    save(STORAGE_KEYS.apiProviders, withBrand);
    // Initialize new keys
    save(STORAGE_KEYS.roleLibrary, load(STORAGE_KEYS.roleLibrary, [] as any[]));
    save(STORAGE_KEYS.workflowPresets, load(STORAGE_KEYS.workflowPresets, [] as any[]));
    save(STORAGE_KEYS.activeWorkflowId, load(STORAGE_KEYS.activeWorkflowId, ''));
    save(STORAGE_KEYS.transcript, load(STORAGE_KEYS.transcript, [] as any[]));
    save(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);
    return { apiProviders: withBrand, teamPresets: loadedTeams, activeTeamId: loadedActiveTeamId, schemaVersion: SCHEMA_VERSION };
  }

  // Migration from legacy config → default provider(s) + default Discussion team
  const providers: ApiProviderConfig[] = [];

  // Legacy OpenAI-compatible
  const legacyUseOpenAI = localStorage.getItem(USE_OPENAI_API_CONFIG_STORAGE_KEY) === 'true';
  const legacyOpenAiBaseUrl = localStorage.getItem(OPENAI_API_BASE_URL_STORAGE_KEY) || DEFAULT_OPENAI_API_BASE_URL;
  const legacyOpenAiKey = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || '';
  const legacyOpenAiCognitoModel = localStorage.getItem(OPENAI_COGNITO_MODEL_ID_STORAGE_KEY) || DEFAULT_OPENAI_COGNITO_MODEL_ID;
  const legacyOpenAiMuseModel = localStorage.getItem(OPENAI_MUSE_MODEL_ID_STORAGE_KEY) || DEFAULT_OPENAI_MUSE_MODEL_ID;

  if (legacyUseOpenAI || legacyOpenAiKey || legacyOpenAiBaseUrl) {
    providers.push({
      id: 'provider-openai-default',
      name: 'OpenAI 兼容渠道',
      providerType: 'openai',
      baseUrl: legacyOpenAiBaseUrl,
      apiKey: legacyOpenAiKey || undefined,
      defaultModel: legacyOpenAiCognitoModel,
      timeoutSeconds: 60,
      capabilities: { supportsSystemInstruction: true, supportsImages: true, supportsThinkingConfig: false },
      brandKey: 'gpt',
    });
  }

  // Legacy Gemini custom config
  const legacyUseCustomGemini = localStorage.getItem(USE_CUSTOM_API_CONFIG_STORAGE_KEY) === 'true';
  const legacyCustomEndpoint = localStorage.getItem(CUSTOM_API_ENDPOINT_STORAGE_KEY) || '';
  const legacyCustomKey = localStorage.getItem(CUSTOM_API_KEY_STORAGE_KEY) || '';

  if (legacyUseCustomGemini || legacyCustomKey) {
    providers.push({
      id: 'provider-gemini-custom',
      name: 'Gemini 自定义渠道',
      providerType: 'gemini',
      baseUrl: legacyCustomEndpoint || undefined,
      apiKey: legacyCustomKey || undefined,
      defaultModel: DEFAULT_COGNITO_MODEL_API_NAME,
      timeoutSeconds: 60,
      capabilities: { supportsSystemInstruction: true, supportsImages: true, supportsThinkingConfig: true },
      brandKey: 'gemini',
    });
  }

  // Fallback Gemini env-based provider if none defined
  if (!providers.length) {
    providers.push({
      id: 'provider-gemini-env',
      name: 'Gemini (环境变量)',
      providerType: 'gemini',
      baseUrl: undefined,
      apiKey: undefined, // rely on process.env.API_KEY
      defaultModel: DEFAULT_COGNITO_MODEL_API_NAME,
      timeoutSeconds: 60,
      capabilities: { supportsSystemInstruction: true, supportsImages: true, supportsThinkingConfig: true },
      brandKey: 'gemini',
    });
  }

  // Choose default provider for team
  const openAiProvider = providers.find(p => p.providerType === 'openai');
  const geminiProvider = providers.find(p => p.providerType === 'gemini');
  const providerForTeam = (legacyUseOpenAI && openAiProvider) ? openAiProvider : (geminiProvider || providers[0]);

  const defaultTeamId = 'team-default-discussion';
  const discussionTeam: DiscussionTeamPreset = {
    id: defaultTeamId,
    name: '默认 Discussion 团队',
    mode: 'discussion',
    discussionMode: DiscussionMode.AiDriven,
    fixedTurns: DEFAULT_MANUAL_FIXED_TURNS,
    cognito: {
      roleId: 'cognito',
      displayName: 'Cognito',
      providerId: providerForTeam.id,
      modelId: providerForTeam.providerType === 'openai' ? legacyOpenAiCognitoModel : DEFAULT_COGNITO_MODEL_API_NAME,
      systemPrompt: COGNITO_SYSTEM_PROMPT_HEADER,
      userPromptTemplate: '{{user_prompt}}',
      parameters: {},
    },
    muse: {
      roleId: 'muse',
      displayName: 'Muse',
      providerId: providerForTeam.id,
      modelId: providerForTeam.providerType === 'openai' ? legacyOpenAiMuseModel : DEFAULT_MUSE_MODEL_API_NAME,
      systemPrompt: MUSE_SYSTEM_PROMPT_HEADER,
      userPromptTemplate: '{{user_prompt}}',
      parameters: {},
    },
  };

  const teamPresets: TeamPreset[] = [discussionTeam];

  // Persist migrated data
  save(STORAGE_KEYS.apiProviders, providers);
  save(STORAGE_KEYS.teamPresets, teamPresets);
  save(STORAGE_KEYS.activeTeamId, defaultTeamId);
  // Initialize new keys for custom workflow
  save(STORAGE_KEYS.roleLibrary, load(STORAGE_KEYS.roleLibrary, [] as any[]));
  save(STORAGE_KEYS.workflowPresets, load(STORAGE_KEYS.workflowPresets, [] as any[]));
  save(STORAGE_KEYS.activeWorkflowId, load(STORAGE_KEYS.activeWorkflowId, ''));
  save(STORAGE_KEYS.transcript, load(STORAGE_KEYS.transcript, [] as any[]));
  // Initialize chats keys
  save(STORAGE_KEYS.chats, load(STORAGE_KEYS.chats, [] as any[]));
  save(STORAGE_KEYS.activeChatId, load(STORAGE_KEYS.activeChatId, ''));
  save(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);

  return {
    apiProviders: providers,
    teamPresets,
    activeTeamId: defaultTeamId,
    schemaVersion: SCHEMA_VERSION,
  };
}
