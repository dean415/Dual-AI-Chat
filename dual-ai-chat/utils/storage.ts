import { ApiProviderConfig, DiscussionMode, DiscussionTeamPreset, MoeTeamPreset, TeamPreset, BrandKey } from '../types';
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
} as const;

export const SCHEMA_VERSION = 3;

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
  save(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);

  return {
    apiProviders: providers,
    teamPresets,
    activeTeamId: defaultTeamId,
    schemaVersion: SCHEMA_VERSION,
  };
}
