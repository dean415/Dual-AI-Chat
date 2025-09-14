import { ApiProviderConfig, RoleConfig } from '../types';
import { renderTemplate } from '../utils/appUtils';
import type { ProviderErrorCode } from './providerAdapter';
import { callModel, callModelWithMessagesStream } from './providerAdapter';
import type { OpenAiChatMessage } from './openaiService';

export interface RoleRunnerInput {
  provider: ApiProviderConfig;
  role: RoleConfig;
  templateVars?: Record<string, string | number | boolean | undefined | null>;
  imageApiPart?: { inlineData: { mimeType: string; data: string } };
  renderOptions?: { keepUnknown?: boolean };
}

export interface RoleRunnerResult {
  text: string;
  durationMs: number;
  errorCode?: ProviderErrorCode;
  errorMessage?: string;
}

export function renderRoleUserPrompt(
  role: RoleConfig,
  vars: RoleRunnerInput['templateVars'] = {},
  options?: RoleRunnerInput['renderOptions']
): string {
  const tpl = role.userPromptTemplate || '';
  return renderTemplate(tpl, vars || {}, options);
}

export async function runRole(_input: RoleRunnerInput): Promise<RoleRunnerResult> {
  const { provider, role, templateVars, imageApiPart, renderOptions } = _input;
  const userPrompt = renderRoleUserPrompt(role, templateVars, renderOptions);
  // Render variables for system prompt as well (same vars/options as user template)
  const systemPrompt = role.systemPrompt
    ? renderTemplate(role.systemPrompt, templateVars || {}, renderOptions)
    : undefined;
  const parameters = role.parameters;

  const res = await callModel({
    provider,
    modelId: role.modelId,
    systemPrompt,
    userPrompt,
    imageApiPart,
    parameters,
  });

  return {
    text: res.text,
    durationMs: res.durationMs,
    errorCode: res.errorCode,
    errorMessage: res.errorMessage,
  };
}

// Streaming variant for OpenAI-compatible providers. Emits deltas via onDelta.
export function runRoleStream(_input: RoleRunnerInput & { onDelta?: (text: string) => void }): { cancel: () => void; done: Promise<RoleRunnerResult> } {
  const { provider, role, templateVars, imageApiPart, renderOptions, onDelta } = _input;
  const userPrompt = renderRoleUserPrompt(role, templateVars, renderOptions);
  const systemPrompt = role.systemPrompt
    ? renderTemplate(role.systemPrompt, templateVars || {}, renderOptions)
    : undefined;
  const parameters = role.parameters;

  // Compose OpenAI chat messages
  const messages: OpenAiChatMessage[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  let userMessageContent: any = userPrompt;
  if (imageApiPart && imageApiPart.inlineData && imageApiPart.inlineData.data) {
    userMessageContent = [
      { type: 'text', text: userPrompt },
      {
        type: 'image_url',
        image_url: {
          url: `data:${imageApiPart.inlineData.mimeType};base64,${imageApiPart.inlineData.data}`,
        },
      },
    ];
  }
  messages.push({ role: 'user', content: userMessageContent });

  const handle = callModelWithMessagesStream({
    provider,
    modelId: role.modelId,
    messages,
    parameters,
    onDelta,
  });

  const done: Promise<RoleRunnerResult> = handle.done.then(res => ({
    text: res.text,
    durationMs: res.durationMs,
    errorCode: res.errorCode,
    errorMessage: res.errorMessage,
  }));

  return { cancel: handle.cancel, done };
}
