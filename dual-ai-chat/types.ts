export enum MessageSender {
  User = '用户',
  Cognito = 'Cognito', // Logical AI
  Muse = 'Muse',     // Creative AI
  System = '系统',
}

export enum MessagePurpose {
  UserInput = 'user-input',
  SystemNotification = 'system-notification',
  CognitoToMuse = 'cognito-to-muse',      // Cognito's message to Muse for discussion
  MuseToCognito = 'muse-to-cognito',      // Muse's response to Cognito
  FinalResponse = 'final-response',       // Final response from Cognito to User
  Cancelled = 'cancelled',                // User cancelled the current AI response
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: MessageSender;
  purpose: MessagePurpose;
  timestamp: Date;
  durationMs?: number; // Time taken to generate this message (for AI messages)
  image?: { // Optional image data for user messages
    dataUrl: string; // base64 data URL for displaying the image
    name: string;
    type: string;
  };
}

// Updated types for structured notepad modifications based on HTML-like tags
export type NotepadAction =
  | { action: 'replace_all'; content: string }
  | { action: 'append'; content: string }
  | { action: 'prepend'; content: string }
  | { action: 'insert'; line: number; content: string } // Changed from insert_after_line, uses 'line'
  | { action: 'replace'; line: number; content: string } // Changed from replace_line, uses 'line'
  | { action: 'delete_line'; line: number } // Action name kept, uses 'line'
  | { action: 'search_and_replace'; find: string; with: string; all?: boolean }; // Uses 'find' and 'with'

export type NotepadUpdatePayload = {
  modifications?: NotepadAction[];
  error?: string; // For reporting parsing errors or action application errors
} | null;

export interface FailedStepPayload {
  stepIdentifier: string;
  prompt: string;
  modelName: string;
  systemInstruction?: string;
  imageApiPart?: { inlineData: { mimeType: string; data: string } };
  sender: MessageSender;
  purpose: MessagePurpose;
  originalSystemErrorMsgId: string;
  thinkingConfig?: { thinkingBudget: number };
  userInputForFlow: string;
  imageApiPartForFlow?: { inlineData: { mimeType: string; data: string } };
  discussionLogBeforeFailure: string[];
  currentTurnIndexForResume?: number;
  previousAISignaledStopForResume?: boolean;
}

export enum DiscussionMode {
  FixedTurns = 'fixed',
  AiDriven = 'ai-driven',
}

// ====== Project-wide extended types (Providers, Teams, MoE) ======

// Provider/channel definitions
export type ProviderType = 'gemini' | 'openai';

export interface ProviderCapabilities {
  supportsSystemInstruction?: boolean;
  supportsImages?: boolean;
  supportsThinkingConfig?: boolean;
}

export type BrandKey = 'generic' | 'gpt' | 'gemini' | 'claude';

export interface ApiProviderConfig {
  id: string;
  name: string;
  providerType: ProviderType;
  baseUrl?: string; // For OpenAI-compatible
  apiKey?: string;  // Optional; many local services don't require
  defaultModel?: string;
  timeoutSeconds?: number; // Optional in UI, service can default
  capabilities: ProviderCapabilities;
  brandKey?: BrandKey; // UI brand icon selection
  brandIconUrl?: string; // Optional custom icon (SVG/PNG) URL
}

// Role configuration within a team preset
export type ReasoningEffort = 'low' | 'medium' | 'high';
export type VerbosityLevel = 'low' | 'medium' | 'high';

export interface RoleParameters {
  temperature?: number;   // 0–2
  top_p?: number;         // 0–1
  reasoning_effort?: ReasoningEffort; // OpenAI ChatGPT specific
  verbosity?: VerbosityLevel;         // OpenAI ChatGPT specific
}

export interface RoleConfig {
  roleId: string;           // e.g., 'cognito', 'muse', 'stage1A'
  displayName: string;      // UI label
  providerId: string;       // Reference to ApiProviderConfig.id
  modelId: string;          // Model name/ID in the chosen provider
  systemPrompt?: string;    // System instruction
  userPromptTemplate?: string; // User prompt template with {{variables}}
  parameters?: RoleParameters;  // Optional tunables
}

// Team presets
export interface DiscussionTeamPreset {
  id: string;
  name: string;
  mode: 'discussion';
  discussionMode: DiscussionMode; // fixed or ai-driven
  fixedTurns: number;             // used when discussionMode === fixed
  cognito: RoleConfig;
  muse: RoleConfig;
}

export interface MoeTeamPreset {
  id: string;
  name: string;
  mode: 'moe';
  stage1A: RoleConfig;
  stage1B: RoleConfig;
  stage2C: RoleConfig;
  stage2D: RoleConfig;
  summarizer: RoleConfig;
}

export type TeamPreset = DiscussionTeamPreset | MoeTeamPreset;

// MoE execution UI types
export type MoaStepId = 'stage1A' | 'stage1B' | 'stage2C' | 'stage2D';
export type MoaStepStatus = 'thinking' | 'done' | 'error';

export interface MoaStepResult {
  stepId: MoaStepId;
  displayName: string;
  status: MoaStepStatus;
  content?: string; // markdown content on success
  error?: string;   // error text on failure
}

// ====== New minimal types for Custom Workflow (Role Library + Workflow) ======

// Role library item (reusable role config without user template)
export interface RoleLibraryItem {
  id: string;
  name: string;             // display name (unique by your convention)
  providerId: string;       // references ApiProviderConfig.id
  modelId: string;          // model identifier for the provider
  systemPrompt?: string;    // optional system instruction
  parameters?: RoleParameters; // optional toggled parameters
}

// Transcript message for future history-N (global memory)
export type TranscriptMessage =
  | { role: 'user'; content: string; at: number }
  | { role: 'assistant_notepad'; content: string; at: number };

// History N options for per-role config
export type HistoryN = 0 | 2 | 4 | 6 | 8;

export interface WorkflowRoundPerRoleOptions {
  historyN: HistoryN;        // Disabled=0 or 2/4/6/8
  receiveFrom: string[];     // role names from previous rounds (UI order)
}

export interface WorkflowRound {
  roles: string[]; // role names in this round (1..4)
  perRole: Record<string, WorkflowRoundPerRoleOptions>;
}

export interface WorkflowPresetMinimal {
  id: string;
  name: string;
  isActive?: boolean; // only one active at a time
  rounds: WorkflowRound[];
}

// ====== Persisted Workflow Runs per Chat (Option B) ======

export type WorkflowStepStatus = 'thinking' | 'done' | 'error';

export interface WorkflowStepRecord {
  roleName: string;
  content: string;
  status: WorkflowStepStatus;
  durationMs?: number;
  error?: string;
  brand?: BrandKey;
  iconUrl?: string;
}

export interface WorkflowRoundRecord {
  steps: WorkflowStepRecord[];
}

export interface WorkflowRunRecord {
  id: string;         // runId
  startedAt: number;  // epoch ms
  name?: string;      // optional label
  rounds: WorkflowRoundRecord[];
}

// ====== Chats (per-conversation storage) ======

export interface NotepadSnapshot {
  at: number;         // timestamp
  content: string;    // full notepad text at this moment
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  workflowId?: string;            // selected workflow for this chat (optional)
  messages: ChatMessage[];        // all chat-area messages (user/system/assistant)
  notepadSnapshots: NotepadSnapshot[]; // per-round (workflow) or per-reply (normal) snapshots
  // New (Option B – Step 1: optional until schema migration)
  workflowRuns?: WorkflowRunRecord[];
  notepadCurrent?: string; // latest Canvas text for quick restore
}
