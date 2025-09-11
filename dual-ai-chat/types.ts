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

export interface ApiProviderConfig {
  id: string;
  name: string;
  providerType: ProviderType;
  baseUrl?: string; // For OpenAI-compatible
  apiKey?: string;  // Optional; many local services don't require
  defaultModel?: string;
  timeoutSeconds?: number; // Optional in UI, service can default
  capabilities: ProviderCapabilities;
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
